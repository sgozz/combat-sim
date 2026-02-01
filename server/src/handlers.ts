import { WebSocket, WebSocketServer } from "ws";
import type {
  ClientToServerMessage,
  MatchState,
  Player,
  RulesetId,
} from "../../shared/types";
import type { CombatActionPayload } from "../../shared/rulesets";
import { isGurpsCombatant } from "../../shared/rulesets";

import { assertRulesetId } from "../../shared/rulesets/defaults";
import { state } from "./state";
import { 
  upsertCharacter,
  findUserByUsername,
  findUserById,
  createUser,
  findSessionByToken,
  createSession,
  updateSessionLastSeen,
  createMatch,
  findMatchByCode,
  findMatchById,
  addMatchMember,
  getMatchMembers,
  getUserMatches,
  buildMatchSummary,
  updateMatchState,
  updateMatchMemberCharacter,
  updateMatchMemberConnection,
  removeMatchMember,
  getMatchMemberCount,
  getActiveMatches,
  buildPublicMatchSummary,
  loadCharactersByOwner,
  countActiveMatchesForCharacter,
  clearCharacterFromWaitingMatches,
  clearDefaultCharacter,
  deleteCharacter,
  getPublicWaitingMatches,
  buildJoinableMatchSummary,
  getReadyPlayers,
} from "./db";
import { 
  sendMessage,
  sendToMatch,
  sendToUser,
  requireUser,
  getCombatantByPlayerId,
  getCharacterById,
  findFreeAdjacentHex,
} from "./helpers";
import { createMatchState } from "./match";
import { addBotToMatch, scheduleBotTurn } from "./bot";
import {
  resolveDefenseChoice,
  handleGurpsAction,
  handlePF2Action,
} from "./handlers/index";

export const handleMessage = async (
  socket: WebSocket,
  wss: WebSocketServer,
  message: ClientToServerMessage
): Promise<void> => {
  switch (message.type) {
    case "register": {
      let user = await findUserByUsername(message.username);
      
      if (!user) {
        user = await createUser(message.username, false, message.preferredRulesetId ?? 'gurps');
      }
      
      state.users.set(user.id, user);
      const session = await createSession(user.id);
      
      state.connections.set(socket, { sessionToken: session.token, userId: user.id });
      state.addUserSocket(user.id, socket);
      
      const userMatches = await getUserMatches(user.id, user.preferredRulesetId);
      const activeMatches = await Promise.all(
        userMatches
          .filter(row => row.status !== 'finished')
          .map(row => buildMatchSummary(row, user.id))
      );
      
      sendMessage(socket, { type: "auth_ok", user, sessionToken: session.token, activeMatches });
      return;
    }
    
    case "auth": {
      const session = await findSessionByToken(message.sessionToken);
      if (!session) {
        sendMessage(socket, { type: "session_invalid" });
        return;
      }
      
      const user = await findUserById(session.userId);
      if (!user) {
        sendMessage(socket, { type: "session_invalid" });
        return;
      }
      
      await updateSessionLastSeen(session.token);
      
      state.users.set(user.id, user);
      state.connections.set(socket, { sessionToken: session.token, userId: user.id });
      state.addUserSocket(user.id, socket);
      
      const userMatches = await getUserMatches(user.id, user.preferredRulesetId);
      const activeMatches = await Promise.all(
        userMatches
          .filter(row => row.status !== 'finished')
          .map(row => buildMatchSummary(row, user.id))
      );
      
      sendMessage(socket, { type: "auth_ok", user, sessionToken: session.token, activeMatches });
      
      const summaries = await Promise.all(
        userMatches.map(row => buildMatchSummary(row, user.id))
      );
      sendMessage(socket, { type: "my_matches", matches: summaries });
      
      return;
    }
    
    case "set_preferred_ruleset": {
      const user = requireUser(socket);
      if (!user) return;
      
      const { rulesetId } = message;
      assertRulesetId(rulesetId);
      
      state.db.prepare("UPDATE users SET preferred_ruleset_id = ? WHERE id = ?").run(rulesetId, user.id);
      user.preferredRulesetId = rulesetId;
      
      const connection = state.connections.get(socket);
      if (!connection || !connection.sessionToken) return;
      
      sendMessage(socket, { type: "auth_ok", user, sessionToken: connection.sessionToken });
      return;
    }
    
    case "list_my_matches": {
      const user = requireUser(socket);
      if (!user) return;
      
      const userMatches = await getUserMatches(user.id, user.preferredRulesetId);
      const summaries = await Promise.all(
        userMatches.map(row => buildMatchSummary(row, user.id))
      );
      sendMessage(socket, { type: "my_matches", matches: summaries });
      return;
    }
    
    case "list_public_matches": {
      const user = requireUser(socket);
      if (!user) return;
      
      const activeMatches = await getActiveMatches();
      const summaries = await Promise.all(
        activeMatches.map(row => buildPublicMatchSummary(row))
      );
      sendMessage(socket, { type: "public_matches", matches: summaries });
      return;
    }
    
    case "spectate_match": {
      const user = requireUser(socket);
      if (!user) return;
      
      let match = state.matches.get(message.matchId);
      
      if (!match) {
        const matchRow = await findMatchById(message.matchId);
        if (matchRow && matchRow.state_json && matchRow.status === 'active') {
          match = JSON.parse(matchRow.state_json) as MatchState;
          state.matches.set(message.matchId, match);
        }
      }
      
      if (!match) {
        sendMessage(socket, { type: "error", message: "Match not found or not active." });
        return;
      }
      
      state.addSpectator(message.matchId, user.id);
      sendMessage(socket, { type: "spectating", matchId: message.matchId });
      sendMessage(socket, { type: "match_state", state: match });
      return;
    }
    
    case "stop_spectating": {
      const user = requireUser(socket);
      if (!user) return;
      
      state.removeSpectator(message.matchId, user.id);
      sendMessage(socket, { type: "stopped_spectating", matchId: message.matchId });
      return;
    }
    
    case "create_match": {
      const user = requireUser(socket);
      if (!user) return;
      
      const { id } = await createMatch(message.name, message.maxPlayers, user.id, user.preferredRulesetId, message.isPublic ?? false);
      await addMatchMember(id, user.id, null);
      
      state.readySets.set(id, new Set());
      
      const matchRow = await findMatchById(id);
      if (!matchRow) {
        sendMessage(socket, { type: "error", message: "Failed to create match." });
        return;
      }
      
      const summary = await buildMatchSummary(matchRow, user.id);
      sendMessage(socket, { type: "match_created", match: summary });
      
      const readyPlayers = getReadyPlayers(id);
      sendMessage(socket, { type: "match_joined", matchId: id, readyPlayers });
      return;
    }
    
    case "join_match": {
      const user = requireUser(socket);
      if (!user) return;
      
      const matchRow = await findMatchByCode(message.code);
      if (!matchRow) {
        sendMessage(socket, { type: "error", message: "Match not found. Check the code and try again." });
        return;
      }
      
      if (matchRow.status !== "waiting") {
        sendMessage(socket, { type: "error", message: "This match has already started." });
        return;
      }
      
      const memberCount = await getMatchMemberCount(matchRow.id);
      if (memberCount >= matchRow.max_players) {
        sendMessage(socket, { type: "error", message: "Match is full." });
        return;
      }
      
      await addMatchMember(matchRow.id, user.id, null);
      
      const members = await getMatchMembers(matchRow.id);
      
      for (const member of members) {
        if (member.user_id !== user.id) {
          const existingUser = state.users.get(member.user_id);
          if (existingUser) {
            sendMessage(socket, { 
              type: "player_joined", 
              matchId: matchRow.id, 
              player: { 
                id: existingUser.id, 
                name: existingUser.username, 
                isBot: existingUser.isBot,
                characterId: member.character_id ?? ""
              } 
            });
          }
        }
      }
      
      const newPlayer: Player = { id: user.id, name: user.username, isBot: false, characterId: "" };
      for (const member of members) {
        if (member.user_id !== user.id) {
          sendToUser(member.user_id, { type: "player_joined", matchId: matchRow.id, player: newPlayer });
        }
      }
      
      const readyPlayers = getReadyPlayers(matchRow.id);
      sendMessage(socket, { type: "match_joined", matchId: matchRow.id, readyPlayers });
      
      const updatedMatchRow = await findMatchById(matchRow.id);
      if (updatedMatchRow) {
        const summary = await buildMatchSummary(updatedMatchRow, user.id);
        sendMessage(socket, { type: "match_created", match: summary });
      }
      
      const existingMatch = state.matches.get(matchRow.id);
      if (existingMatch) {
        sendMessage(socket, { type: "match_state", state: existingMatch });
      }
      
      return;
    }
    
    case "leave_match": {
      const user = requireUser(socket);
      if (!user) return;
      
      const matchRow = await findMatchById(message.matchId);
      if (!matchRow) {
        sendMessage(socket, { type: "error", message: "Match not found." });
        return;
      }
      
      await removeMatchMember(message.matchId, user.id);
      sendMessage(socket, { type: "match_left", matchId: message.matchId });
      
      await sendToMatch(message.matchId, { 
        type: "player_left", 
        matchId: message.matchId, 
        playerId: user.id, 
        playerName: user.username 
      });
      
      return;
    }
    
    case "rejoin_match": {
      const user = requireUser(socket);
      if (!user) return;
      
      const matchRow = await findMatchById(message.matchId);
      if (!matchRow) {
        sendMessage(socket, { type: "error", message: "Match not found." });
        return;
      }
      
      const members = await getMatchMembers(matchRow.id);
      const isMember = members.some(m => m.user_id === user.id);
      if (!isMember) {
        sendMessage(socket, { type: "error", message: "You are not a member of this match." });
        return;
      }
      
      let matchState = state.matches.get(matchRow.id);
      if (!matchState && matchRow.state_json) {
        matchState = JSON.parse(matchRow.state_json) as MatchState;
        state.matches.set(matchRow.id, matchState);
      }
      
      if (matchState) {
        await updateMatchMemberConnection(matchRow.id, user.id, true);
        sendMessage(socket, { type: "match_state", state: matchState });
        
        if (matchState.status === 'paused' && matchState.pausedForPlayerId === user.id) {
          const resumed: MatchState = { ...matchState, status: 'active', pausedForPlayerId: undefined };
          state.matches.set(matchRow.id, resumed);
          await updateMatchState(matchRow.id, resumed);
          await sendToMatch(matchRow.id, { type: "match_state", state: resumed });
        }
        
        await sendToMatch(matchRow.id, { 
          type: "player_reconnected", 
          matchId: matchRow.id, 
          playerId: user.id, 
          playerName: user.username 
        });
      } else {
        const summary = await buildMatchSummary(matchRow, user.id);
        sendMessage(socket, { type: "match_created", match: summary });
        
        for (const member of members) {
          if (member.user_id !== user.id) {
            const existingUser = state.users.get(member.user_id);
            if (existingUser) {
              sendMessage(socket, { 
                type: "player_joined", 
                matchId: matchRow.id, 
                player: { 
                  id: existingUser.id, 
                  name: existingUser.username, 
                  isBot: existingUser.isBot,
                  characterId: member.character_id ?? ""
                } 
              });
            }
          }
        }
        
        for (const member of members) {
          if (member.user_id !== user.id) {
            sendToUser(member.user_id, { 
              type: "player_reconnected", 
              matchId: matchRow.id, 
              playerId: user.id, 
              playerName: user.username 
            });
          }
        }
      }
      
      return;
    }
    
    case "select_character": {
      const user = requireUser(socket);
      if (!user) return;
      
      await upsertCharacter(message.character, user.id);
      state.characters.set(message.character.id, message.character);
      await updateMatchMemberCharacter(message.matchId, user.id, message.character.id);
      
      return;
    }
    
    case "start_combat": {
      const user = requireUser(socket);
      if (!user) return;
      
      const matchRow = await findMatchById(message.matchId);
      if (!matchRow) {
        sendMessage(socket, { type: "error", message: "Match not found." });
        return;
      }
      
      if (matchRow.status !== "waiting") {
        sendMessage(socket, { type: "error", message: "Match already started." });
        return;
      }
      
      const members = await getMatchMembers(message.matchId);
      const humanMembers = members.filter(m => {
        const u = state.users.get(m.user_id);
        return u && !u.isBot;
      });
      
      const readySet = state.readySets.get(message.matchId) ?? new Set();
      const allReady = humanMembers.every(m => readySet.has(m.user_id));
      
      if (!allReady) {
        sendMessage(socket, { type: "error", message: "Not all players are ready" });
        return;
      }
      
      state.readySets.delete(message.matchId);
      
      const requestedBots = message.botCount ?? 0;
      const maxBots = matchRow.max_players - members.length;
      const botsToAdd = Math.min(Math.max(0, requestedBots), maxBots);
      
      const rulesetId = assertRulesetId(matchRow.ruleset_id as unknown as RulesetId | undefined);
      
      for (let i = 0; i < botsToAdd; i++) {
        await addBotToMatch(message.matchId, rulesetId);
      }
      
      const finalMembers = await getMatchMembers(message.matchId);
      if (finalMembers.length < 2) {
        sendMessage(socket, { type: "error", message: "Need at least 2 players to start." });
        return;
      }
      const matchState = await createMatchState(message.matchId, matchRow.name, matchRow.code, matchRow.max_players, rulesetId);
      state.matches.set(message.matchId, matchState);
      await updateMatchState(message.matchId, matchState);
      
      await sendToMatch(message.matchId, { type: "match_state", state: matchState });
      scheduleBotTurn(message.matchId, matchState);
      return;
    }
    
    case "action": {
      const user = requireUser(socket);
      if (!user) return;
      
      const match = state.matches.get(message.matchId);
      if (!match) {
        sendMessage(socket, { type: "error", message: "Match not found." });
        return;
      }
      
      if (match.status === "finished") {
        sendMessage(socket, { type: "error", message: "Match is over." });
        return;
      }
      
      const payload = message.payload;
      if (!payload || payload.type !== message.action) {
        sendMessage(socket, { type: "error", message: "Invalid action payload." });
        return;
      }
      
      const player = match.players.find(p => p.id === user.id);
      if (!player) {
        sendMessage(socket, { type: "error", message: "You are not in this match." });
        return;
      }
      
      await handleCombatAction(socket, message.matchId, match, player, payload);
      return;
    }
    
    case "list_characters": {
      const user = requireUser(socket);
      if (!user) return;
      
      const characters = await loadCharactersByOwner(user.id, user.preferredRulesetId);
      sendMessage(socket, { type: "character_list", characters });
      return;
    }
    
    case "save_character": {
      const user = requireUser(socket);
      if (!user) return;
      
      const existingChar = state.db.prepare(`
        SELECT owner_id FROM characters WHERE id = ?
      `).get(message.character.id) as { owner_id: string } | undefined;
      
      if (existingChar && existingChar.owner_id !== user.id) {
        sendMessage(socket, { type: "error", message: "You do not own this character" });
        return;
      }
      
      await upsertCharacter(message.character, user.id);
      sendMessage(socket, { type: "character_saved", characterId: message.character.id });
      return;
    }
    
    case "delete_character": {
      const user = requireUser(socket);
      if (!user) return;
      
      const char = state.db.prepare(`
        SELECT owner_id FROM characters WHERE id = ?
      `).get(message.characterId) as { owner_id: string } | undefined;
      
      if (!char) {
        sendMessage(socket, { type: "error", message: "Character not found" });
        return;
      }
      
      if (char.owner_id !== user.id) {
        sendMessage(socket, { type: "error", message: "You do not own this character" });
        return;
      }
      
      const activeCount = countActiveMatchesForCharacter(message.characterId);
      if (activeCount > 0) {
        sendMessage(socket, { type: "error", message: "Cannot delete a character in an active match" });
        return;
      }
      
      clearCharacterFromWaitingMatches(message.characterId);
      clearDefaultCharacter(message.characterId);
      deleteCharacter(message.characterId, user.id);
      
      sendMessage(socket, { type: "character_deleted", characterId: message.characterId });
      return;
    }
    
    case "toggle_favorite": {
      const user = requireUser(socket);
      if (!user) return;
      
      const char = state.db.prepare(`
        SELECT owner_id, is_favorite FROM characters WHERE id = ?
      `).get(message.characterId) as { owner_id: string; is_favorite: number } | undefined;
      
      if (!char) {
        sendMessage(socket, { type: "error", message: "Character not found" });
        return;
      }
      
      if (char.owner_id !== user.id) {
        sendMessage(socket, { type: "error", message: "You do not own this character" });
        return;
      }
      
      const newFavorite = char.is_favorite === 1 ? 0 : 1;
      state.db.prepare(`
        UPDATE characters SET is_favorite = ? WHERE id = ?
      `).run(newFavorite, message.characterId);
      
      sendMessage(socket, { 
        type: "character_favorited", 
        characterId: message.characterId, 
        isFavorite: Boolean(newFavorite) 
      });
      return;
    }
    
    case "player_ready": {
      const user = requireUser(socket);
      if (!user) return;
      
      const match = await findMatchById(message.matchId);
      if (!match) {
        sendMessage(socket, { type: "error", message: "Match not found" });
        return;
      }
      
      if (match.status !== 'waiting') {
        sendMessage(socket, { type: "error", message: "Match has already started" });
        return;
      }
      
      let readySet = state.readySets.get(message.matchId);
      if (!readySet) {
        readySet = new Set();
        state.readySets.set(message.matchId, readySet);
      }
      
      if (message.ready) {
        readySet.add(user.id);
      } else {
        readySet.delete(user.id);
      }
      
      await sendToMatch(message.matchId, {
        type: "player_ready_update",
        matchId: message.matchId,
        playerId: user.id,
        ready: message.ready,
      });
      
      const members = await getMatchMembers(message.matchId);
      const humanMembers = members.filter(m => {
        const u = state.users.get(m.user_id);
        return u && !u.isBot;
      });
      
      const allReady = humanMembers.every(m => readySet.has(m.user_id));
      
      if (allReady && humanMembers.length > 0) {
        await sendToMatch(message.matchId, {
          type: "all_players_ready",
          matchId: message.matchId,
        });
      }
      
      return;
    }
    
    case "update_match_settings": {
      const user = requireUser(socket);
      if (!user) return;
      
      const match = await findMatchById(message.matchId);
      if (!match) {
        sendMessage(socket, { type: "error", message: "Match not found" });
        return;
      }
      
      if (match.created_by !== user.id) {
        sendMessage(socket, { type: "error", message: "Only the match creator can change settings" });
        return;
      }
      
      if (match.status !== 'waiting') {
        sendMessage(socket, { type: "error", message: "Cannot change settings after match has started" });
        return;
      }
      
      if (message.settings.isPublic !== undefined) {
        state.db.prepare(`
          UPDATE matches SET is_public = ? WHERE id = ?
        `).run(message.settings.isPublic ? 1 : 0, message.matchId);
      }
      
      await sendToMatch(message.matchId, {
        type: "match_settings_updated",
        matchId: message.matchId,
        settings: {
          isPublic: message.settings.isPublic ?? Boolean(match.is_public),
        },
      });
      
      return;
    }
    
    case "list_public_waiting": {
      const user = requireUser(socket);
      if (!user) return;
      
      const matches = getPublicWaitingMatches(user.preferredRulesetId);
      const summaries = await Promise.all(
        matches.map(row => buildJoinableMatchSummary(row, user.id))
      );
      
      sendMessage(socket, { type: "public_waiting_list", matches: summaries });
      return;
    }
    
    default:
      return;
  }
};

const handleCombatAction = async (
  socket: WebSocket,
  matchId: string,
  match: MatchState,
  player: Player,
  payload: CombatActionPayload
): Promise<void> => {
   if (payload.type === "respond_exit") {
     const actorCombatant = getCombatantByPlayerId(match, player.id);
     if (!actorCombatant) {
       sendMessage(socket, { type: "error", message: "Combatant not found." });
       return;
     }
     
     const pendingExit = match.combatants.find(c => isGurpsCombatant(c) && c.inCloseCombatWith === player.id);
    if (!pendingExit) {
      sendMessage(socket, { type: "error", message: "No pending exit." });
      return;
    }
    
    const actorChar = getCharacterById(match, actorCombatant.characterId);
    const exitingChar = getCharacterById(match, pendingExit.characterId);
    const exitHex = findFreeAdjacentHex(pendingExit.position, match.combatants);
    
    if (payload.response === 'let_go') {
      const updatedCombatants = match.combatants.map(c => {
        if (c.playerId === pendingExit.playerId) {
          return { ...c, inCloseCombatWith: null, closeCombatPosition: null, position: exitHex ?? c.position };
        }
        if (c.playerId === player.id) {
          return { ...c, inCloseCombatWith: null, closeCombatPosition: null };
        }
        return c;
      });
      
      const updated: MatchState = {
        ...match,
        combatants: updatedCombatants,
        log: [...match.log, `${actorChar?.name} lets ${exitingChar?.name} exit close combat.`],
      };
      state.matches.set(matchId, updated);
      await updateMatchState(matchId, updated);
      await sendToMatch(matchId, { type: "match_state", state: updated });
    } else if (payload.response === 'follow') {
      const updated: MatchState = {
        ...match,
        log: [...match.log, `${actorChar?.name} follows ${exitingChar?.name}, maintaining close combat.`],
      };
      state.matches.set(matchId, updated);
      await updateMatchState(matchId, updated);
      await sendToMatch(matchId, { type: "match_state", state: updated });
    } else if (payload.response === 'attack') {
      const updatedCombatants = match.combatants.map(c => {
        if (c.playerId === player.id) {
          return { ...c, usedReaction: true, inCloseCombatWith: null, closeCombatPosition: null };
        }
        if (c.playerId === pendingExit.playerId) {
          return { ...c, inCloseCombatWith: null, closeCombatPosition: null, position: exitHex ?? c.position };
        }
        return c;
      });
      
      const updated: MatchState = {
        ...match,
        combatants: updatedCombatants,
        log: [...match.log, `${actorChar?.name} makes a free attack as ${exitingChar?.name} exits close combat!`],
      };
      state.matches.set(matchId, updated);
      await updateMatchState(matchId, updated);
      await sendToMatch(matchId, { type: "match_state", state: updated });
    }
    return;
  }
  
  if (payload.type === "surrender") {
    const opponent = match.players.find(p => p.id !== player.id);
    const updated: MatchState = {
      ...match,
      status: "finished",
      finishedAt: Date.now(),
      winnerId: opponent?.id,
      log: [...match.log, `${player.name} surrenders! ${opponent?.name ?? 'Opponent'} wins!`],
    };
    state.matches.set(matchId, updated);
    await updateMatchState(matchId, updated);
    await sendToMatch(matchId, { type: "match_state", state: updated });
    return;
  }

  if (payload.type === "defend" && match.pendingDefense?.defenderId === player.id) {
    await resolveDefenseChoice(matchId, match, payload);
    return;
  }

  if (match.activeTurnPlayerId !== player.id) {
    sendMessage(socket, { type: "error", message: "Not your turn." });
    return;
  }
  
  const actorCombatant = getCombatantByPlayerId(match, player.id);
  if (!actorCombatant) {
    sendMessage(socket, { type: "error", message: "Combatant not found." });
    return;
  }

  if (match.rulesetId === 'pf2') {
    return handlePF2Action(socket, matchId, match, player, actorCombatant, payload as Parameters<typeof handlePF2Action>[5]);
  }

  return handleGurpsAction(socket, matchId, match, player, actorCombatant, payload);
};
