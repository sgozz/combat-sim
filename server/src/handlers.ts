import { WebSocket, WebSocketServer } from "ws";
import type {
  ClientToServerMessage,
  CombatActionPayload,
  MatchState,
  Player,
  HexCoord,
  User,
} from "../../shared/types";
import { 
  advanceTurn, 
  getPostureModifiers,
  initializeTurnMovement,
  calculateReachableHexesInfo,
  gridToHex,
  calculateEncumbrance,
  canChangePostureFree,
} from "../../shared/rules";
import { state } from "./state";
import { 
  loadCharacterById,
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
} from "./db";
import { 
  sendMessage,
  sendToMatch,
  sendToUser,
  requireUser,
  calculateHexDistance, 
  getCombatantByPlayerId, 
  getCharacterById,
  calculateFacing,
  findFreeAdjacentHex,
} from "./helpers";
import { createMatchState } from "./match";
import { addBotToMatch, scheduleBotTurn } from "./bot";
import {
  handleMoveStep,
  handleRotate,
  handleUndoMovement,
  handleConfirmMovement,
  handleSkipMovement,
  handleEnterCloseCombat,
  handleExitCloseCombat,
  handleGrapple,
  handleBreakFree,
  handleReadyAction,
  handleAttackAction,
  resolveDefenseChoice,
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
        user = await createUser(message.username);
      }
      
      state.users.set(user.id, user);
      const session = await createSession(user.id);
      
      state.connections.set(socket, { sessionToken: session.token, userId: user.id });
      state.addUserSocket(user.id, socket);
      
      sendMessage(socket, { type: "auth_ok", user, sessionToken: session.token });
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
      
      sendMessage(socket, { type: "auth_ok", user, sessionToken: session.token });
      
      const userMatches = await getUserMatches(user.id);
      const summaries = await Promise.all(
        userMatches.map(row => buildMatchSummary(row, user.id))
      );
      sendMessage(socket, { type: "my_matches", matches: summaries });
      
      return;
    }
    
    case "list_my_matches": {
      const user = requireUser(socket);
      if (!user) return;
      
      const userMatches = await getUserMatches(user.id);
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
      
      const match = state.matches.get(message.matchId);
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
      
      const { id, code } = await createMatch(message.name, message.maxPlayers, user.id);
      await addMatchMember(id, user.id, null);
      
      const matchRow = await findMatchById(id);
      if (!matchRow) {
        sendMessage(socket, { type: "error", message: "Failed to create match." });
        return;
      }
      
      const summary = await buildMatchSummary(matchRow, user.id);
      sendMessage(socket, { type: "match_created", match: summary });
      sendMessage(socket, { type: "match_joined", matchId: id });
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
      const newPlayer: Player = { id: user.id, name: user.username, isBot: false, characterId: "" };
      for (const member of members) {
        if (member.user_id !== user.id) {
          sendToUser(member.user_id, { type: "player_joined", matchId: matchRow.id, player: newPlayer });
        }
      }
      
      sendMessage(socket, { type: "match_joined", matchId: matchRow.id });
      
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
      const requestedBots = message.botCount ?? 0;
      const maxBots = matchRow.max_players - members.length;
      const botsToAdd = Math.min(Math.max(0, requestedBots), maxBots);
      
      for (let i = 0; i < botsToAdd; i++) {
        await addBotToMatch(message.matchId);
      }
      
      const finalMembers = await getMatchMembers(message.matchId);
      if (finalMembers.length < 2) {
        sendMessage(socket, { type: "error", message: "Need at least 2 players to start." });
        return;
      }
      
      const matchState = await createMatchState(message.matchId, matchRow.name, matchRow.code, matchRow.max_players);
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
    
    const pendingExit = match.combatants.find(c => c.inCloseCombatWith === player.id);
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

  if (payload.type === "select_maneuver") {
    if (match.turnMovement?.phase === 'moving') {
      sendMessage(socket, { type: "error", message: "Cannot change maneuver during movement." });
      return;
    }
    
    const previousManeuver = actorCombatant.maneuver;
    const newManeuver = payload.maneuver;
    const aoaVariant = payload.aoaVariant ?? null;
    const aodVariant = payload.aodVariant ?? null;
    
    if (newManeuver === 'all_out_attack' && !aoaVariant) {
      sendMessage(socket, { type: "error", message: "All-Out Attack requires a variant (determined/strong/double/feint)." });
      return;
    }
    
    if (newManeuver === 'all_out_defense' && !aodVariant) {
      sendMessage(socket, { type: "error", message: "All-Out Defense requires a variant (increased_dodge/increased_parry/increased_block/double)." });
      return;
    }
    
    const updatedCombatants = match.combatants.map((c) => {
      if (c.playerId !== player.id) return c;
      
      let aimTurns = c.aimTurns;
      let aimTargetId = c.aimTargetId;
      let evaluateBonus = c.evaluateBonus;
      let evaluateTargetId = c.evaluateTargetId;
      
      if (newManeuver === 'aim') {
        if (previousManeuver === 'aim') {
          aimTurns = Math.min(aimTurns + 1, 3);
        } else {
          aimTurns = 1;
        }
      } else {
        aimTurns = 0;
        aimTargetId = null;
      }
      
      if (newManeuver !== 'evaluate' && newManeuver !== 'attack' && newManeuver !== 'all_out_attack' && newManeuver !== 'move_and_attack') {
        evaluateBonus = 0;
        evaluateTargetId = null;
      }
      
      const attacksRemaining = (newManeuver === 'all_out_attack' && aoaVariant === 'double') ? 2 : 1;
      
      return { ...c, maneuver: newManeuver, aoaVariant, aodVariant, aimTurns, aimTargetId, evaluateBonus, evaluateTargetId, attacksRemaining };
    });
    
    let logMsg = `${player.name} chooses ${newManeuver.replace(/_/g, " ")}`;
    if (newManeuver === 'all_out_attack' && aoaVariant) {
      logMsg += ` (${aoaVariant})`;
    }
    if (newManeuver === 'all_out_defense' && aodVariant) {
      logMsg += ` (${aodVariant.replace(/_/g, ' ')})`;
    }
    const updatedActor = updatedCombatants.find(c => c.playerId === player.id);
    if (newManeuver === 'aim' && updatedActor && updatedActor.aimTurns > 1) {
      logMsg += ` (turn ${updatedActor.aimTurns})`;
    }
    logMsg += '.';
    
    const actorCharacter = getCharacterById(match, actorCombatant.characterId);
    const baseMove = actorCharacter?.derived.basicMove ?? 5;
    const encumbrance = calculateEncumbrance(
      actorCharacter?.attributes.strength ?? 10, 
      actorCharacter?.equipment ?? []
    );
    const basicMove = Math.max(1, baseMove + encumbrance.movePenalty);
    
    const turnMovement = initializeTurnMovement(
      gridToHex(actorCombatant.position),
      actorCombatant.facing,
      newManeuver,
      basicMove,
      actorCombatant.posture
    );
    
    const occupiedHexes: HexCoord[] = match.combatants
      .filter(c => c.playerId !== player.id)
      .map(c => gridToHex(c.position));
    
    const reachableHexes = turnMovement.phase === 'moving' 
      ? calculateReachableHexesInfo(turnMovement, occupiedHexes)
      : [];
    
    const updated: MatchState = {
      ...match,
      combatants: updatedCombatants,
      log: [...match.log, logMsg],
      turnMovement,
      reachableHexes,
    };
    state.matches.set(matchId, updated);
    await updateMatchState(matchId, updated);
    await sendToMatch(matchId, { type: "match_state", state: updated });
    return;
  }

  if (!actorCombatant.maneuver) {
    sendMessage(socket, { type: "error", message: "Select a maneuver first." });
    return;
  }

  if (payload.type === "move_step") {
    await handleMoveStep(socket, matchId, match, player, actorCombatant, payload);
    return;
  }

  if (payload.type === "rotate") {
    await handleRotate(socket, matchId, match, player, actorCombatant, payload);
    return;
  }

  if (payload.type === "undo_movement") {
    await handleUndoMovement(socket, matchId, match, player, actorCombatant);
    return;
  }

  if (payload.type === "confirm_movement") {
    await handleConfirmMovement(socket, matchId, match, player, actorCombatant);
    return;
  }

  if (payload.type === "skip_movement") {
    await handleSkipMovement(socket, matchId, match, player, actorCombatant);
    return;
  }

  if (payload.type === "turn_left" || payload.type === "turn_right") {
    if (actorCombatant.inCloseCombatWith) {
      sendMessage(socket, { type: "error", message: "Cannot turn while in close combat." });
      return;
    }
    const delta = payload.type === "turn_right" ? 1 : -1;
    const newFacing = (actorCombatant.facing + delta + 6) % 6;
    const updatedCombatants = match.combatants.map((c) =>
      c.playerId === player.id ? { ...c, facing: newFacing } : c
    );
    
    const dirName = payload.type === "turn_right" ? "right" : "left";
    const updated = {
        ...match,
        combatants: updatedCombatants,
        log: [...match.log, `${player.name} turns ${dirName}.`]
    };
    
    state.matches.set(matchId, updated);
    await updateMatchState(matchId, updated);
    await sendToMatch(matchId, { type: "match_state", state: updated });
    return;
  }

  if (payload.type === "aim_target") {
    if (actorCombatant.maneuver !== 'aim') {
      sendMessage(socket, { type: "error", message: "Must select Aim maneuver first." });
      return;
    }
    const targetCombatant = match.combatants.find(c => c.playerId === payload.targetId);
    if (!targetCombatant) {
      sendMessage(socket, { type: "error", message: "Target not found." });
      return;
    }
    const targetPlayer = match.players.find(p => p.id === payload.targetId);
    const updatedCombatants = match.combatants.map((c) =>
      c.playerId === player.id ? { ...c, aimTargetId: payload.targetId } : c
    );
    const updated = advanceTurn({
      ...match,
      combatants: updatedCombatants,
      log: [...match.log, `${player.name} aims at ${targetPlayer?.name ?? 'target'}.`],
    });
    state.matches.set(matchId, updated);
    await updateMatchState(matchId, updated);
    await sendToMatch(matchId, { type: "match_state", state: updated });
    scheduleBotTurn(matchId, updated);
    return;
  }

  if (payload.type === "evaluate_target") {
    if (actorCombatant.maneuver !== 'evaluate') {
      sendMessage(socket, { type: "error", message: "Must select Evaluate maneuver first." });
      return;
    }
    const targetCombatant = match.combatants.find(c => c.playerId === payload.targetId);
    if (!targetCombatant) {
      sendMessage(socket, { type: "error", message: "Target not found." });
      return;
    }
    const targetPlayer = match.players.find(p => p.id === payload.targetId);
    
    const isSameTarget = actorCombatant.evaluateTargetId === payload.targetId;
    const newBonus = isSameTarget ? Math.min(3, actorCombatant.evaluateBonus + 1) : 1;
    
    const updatedCombatants = match.combatants.map((c) =>
      c.playerId === player.id 
        ? { ...c, evaluateTargetId: payload.targetId, evaluateBonus: newBonus } 
        : c
    );
    
    const bonusStr = newBonus > 1 ? ` (+${newBonus})` : ' (+1)';
    const updated = advanceTurn({
      ...match,
      combatants: updatedCombatants,
      log: [...match.log, `${player.name} evaluates ${targetPlayer?.name ?? 'target'}${bonusStr}.`],
    });
    state.matches.set(matchId, updated);
    await updateMatchState(matchId, updated);
    await sendToMatch(matchId, { type: "match_state", state: updated });
    scheduleBotTurn(matchId, updated);
    return;
  }

  if (payload.type === "set_wait_trigger") {
    if (actorCombatant.maneuver !== 'wait') {
      sendMessage(socket, { type: "error", message: "Must select Wait maneuver first." });
      return;
    }
    const trigger = payload.trigger;
    
    const conditionDesc: Record<string, string> = {
      'enemy_moves_adjacent': 'an enemy moves adjacent',
      'enemy_attacks_me': 'an enemy attacks them',
      'enemy_attacks_ally': 'an enemy attacks an ally',
      'enemy_enters_reach': 'an enemy enters weapon reach',
    };
    const actionDesc = trigger.action === 'attack' ? 'attack' : trigger.action === 'move' ? 'move' : 'ready';
    
    const updatedCombatants = match.combatants.map((c) =>
      c.playerId === player.id 
        ? { ...c, waitTrigger: trigger } 
        : c
    );
    
    const updated = advanceTurn({
      ...match,
      combatants: updatedCombatants,
      log: [...match.log, `${player.name} waits to ${actionDesc} when ${conditionDesc[trigger.condition] ?? trigger.condition}.`],
    });
    state.matches.set(matchId, updated);
    await updateMatchState(matchId, updated);
    await sendToMatch(matchId, { type: "match_state", state: updated });
    scheduleBotTurn(matchId, updated);
    return;
  }

  if (payload.type === "end_turn") {
    const updated = advanceTurn({
      ...match,
      log: [...match.log, `${player.name} ends their turn.`],
    });
    state.matches.set(matchId, updated);
    await updateMatchState(matchId, updated);
    await sendToMatch(matchId, { type: "match_state", state: updated });
    scheduleBotTurn(matchId, updated);
    return;
  }

  if (payload.type === "change_posture") {
    const newPosture = payload.posture;
    const oldPosture = actorCombatant.posture;
    if (newPosture === oldPosture) {
      sendMessage(socket, { type: "error", message: "Already in that posture." });
      return;
    }
    
    const isFreeChange = canChangePostureFree(oldPosture, newPosture);
    
    if (!isFreeChange && actorCombatant.maneuver !== 'change_posture') {
      sendMessage(socket, { type: "error", message: `Changing from ${oldPosture} to ${newPosture} requires Change Posture maneuver.` });
      return;
    }
    
    const updatedCombatants = match.combatants.map((c) =>
      c.playerId === player.id ? { ...c, posture: newPosture } : c
    );
    
    if (isFreeChange) {
      const updated: MatchState = {
        ...match,
        combatants: updatedCombatants,
        log: [...match.log, `${player.name} changes to ${newPosture} posture (free action).`],
      };
      state.matches.set(matchId, updated);
      await updateMatchState(matchId, updated);
      await sendToMatch(matchId, { type: "match_state", state: updated });
    } else {
      const updated = advanceTurn({
        ...match,
        combatants: updatedCombatants,
        log: [...match.log, `${player.name} changes to ${newPosture} posture.`],
      });
      state.matches.set(matchId, updated);
      await updateMatchState(matchId, updated);
      await sendToMatch(matchId, { type: "match_state", state: updated });
      scheduleBotTurn(matchId, updated);
    }
    return;
  }

  if (payload.type === "move") {
    if (actorCombatant.inCloseCombatWith) {
      sendMessage(socket, { type: "error", message: "Cannot move while in close combat. Use Exit Close Combat first." });
      return;
    }
    
    const actorCharacter = getCharacterById(match, actorCombatant.characterId);
    if (!actorCharacter) {
      sendMessage(socket, { type: "error", message: "Character not found." });
      return;
    }
    
    const occupant = match.combatants.find(c => 
      c.playerId !== player.id && 
      c.position.x === payload.position.x && 
      c.position.z === payload.position.z
    );
    if (occupant) {
      sendMessage(socket, { type: "error", message: "Hex is occupied. Use Enter Close Combat to share hex." });
      return;
    }
    
    const distance = calculateHexDistance(actorCombatant.position, payload.position);
    const postureMods = getPostureModifiers(actorCombatant.posture);
    
    let allowed = Math.floor(actorCharacter.derived.basicMove * postureMods.moveMultiplier);
    const m = actorCombatant.maneuver;
    
    if (m === 'do_nothing' || m === 'all_out_defense') {
       if (m === 'do_nothing') allowed = 0;
       else allowed = Math.min(allowed, 1);
    } else if (m === 'attack' || m === 'all_out_attack' || m === 'aim') {
       if (m === 'all_out_attack') {
         allowed = Math.min(allowed, Math.floor(actorCharacter.derived.basicMove / 2));
       } else {
         if (actorCombatant.statusEffects.includes('has_stepped')) {
           sendMessage(socket, { type: "error", message: "Already stepped this turn." });
           return;
         }
         allowed = Math.min(allowed, 1);
       }
    }

    if (distance > allowed) {
      sendMessage(socket, { type: "error", message: `Move exceeds allowed for ${m} (${allowed}).` });
      return;
    }
    const newFacing = calculateFacing(actorCombatant.position, payload.position);
    const updatedCombatants = match.combatants.map((combatant) =>
      combatant.playerId === player.id
        ? { 
            ...combatant, 
            position: { x: payload.position.x, y: 0, z: payload.position.z },
            facing: newFacing,
            statusEffects: [...combatant.statusEffects, 'has_stepped']
          }
        : combatant
    );
    
    const allowsActionAfterMove = m === 'attack' || m === 'aim' || m === 'move_and_attack';
    
    if (allowsActionAfterMove) {
      const moveVerb = m === 'move_and_attack' ? 'moves' : 'steps';
      const updated: MatchState = {
        ...match,
        combatants: updatedCombatants,
        log: [...match.log, `${player.name} ${moveVerb} to (${payload.position.x}, ${payload.position.z}).`],
      };
      state.matches.set(matchId, updated);
      await updateMatchState(matchId, updated);
      await sendToMatch(matchId, { type: "match_state", state: updated });
      return;
    }
    
    const updated = advanceTurn({
      ...match,
      combatants: updatedCombatants,
      log: [...match.log, `${player.name} moves to (${payload.position.x}, ${payload.position.z}).`],
    });
    state.matches.set(matchId, updated);
    await updateMatchState(matchId, updated);
    await sendToMatch(matchId, { type: "match_state", state: updated });
    scheduleBotTurn(matchId, updated);
    return;
  }

  if (payload.type === "defend") {
    if (match.pendingDefense && match.pendingDefense.defenderId === player.id) {
      await resolveDefenseChoice(matchId, match, payload);
      return;
    }
    
    const updated = advanceTurn({
      ...match,
      combatants: match.combatants.map((combatant) =>
        combatant.playerId === player.id
          ? { ...combatant, statusEffects: [...combatant.statusEffects, "defending"] }
          : combatant
      ),
      log: [...match.log, `${player.name} takes a defensive posture.`],
    });
    state.matches.set(matchId, updated);
    await updateMatchState(matchId, updated);
    await sendToMatch(matchId, { type: "match_state", state: updated });
    scheduleBotTurn(matchId, updated);
    return;
  }

  if (payload.type === "attack") {
    await handleAttackAction(socket, matchId, match, player, actorCombatant, payload);
    return;
  }

  if (payload.type === "ready_action") {
    await handleReadyAction(socket, matchId, match, player, actorCombatant, payload);
    return;
  }

  if (payload.type === "enter_close_combat") {
    await handleEnterCloseCombat(socket, matchId, match, player, actorCombatant, payload);
    return;
  }

  if (payload.type === "exit_close_combat") {
    await handleExitCloseCombat(socket, matchId, match, player, actorCombatant);
    return;
  }

  if (payload.type === "grapple") {
    await handleGrapple(socket, matchId, match, player, actorCombatant, payload);
    return;
  }

  if (payload.type === "break_free") {
    await handleBreakFree(socket, matchId, match, player, actorCombatant);
    return;
  }

  sendMessage(socket, { type: "error", message: "Action handling not implemented." });
};
