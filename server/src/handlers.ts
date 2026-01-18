import { randomUUID } from "node:crypto";
import { WebSocket, WebSocketServer } from "ws";
import type {
  ClientToServerMessage,
  CombatActionPayload,
  MatchState,
  Player,
  HexCoord,
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
import type { Lobby, PlayerRow } from "./types";
import { state } from "./state";
import { 
  loadCharacterById, 
  upsertCharacter, 
  upsertPlayerProfile, 
  upsertMatch, 
  persistLobbyState,
  deleteLobby,
  findUserByUsername,
  findUserById,
  createUser,
  updateUserLastLogin,
  findSessionByToken,
  createSession,
  updateSessionLastSeen,
} from "./db";
import { 
  sendMessage, 
  sendToLobby, 
  requirePlayer, 
  summarizeLobby,
  calculateHexDistance, 
  getCombatantByPlayerId, 
  getCharacterById,
  calculateFacing,
  findFreeAdjacentHex,
  findLobbyByIdOrPrefix,
} from "./helpers";
import { broadcastLobbies, leaveLobby } from "./lobby";
import { createMatchState } from "./match";
import { scheduleBotTurn } from "./bot";
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
      } else {
        await updateUserLastLogin(user.id);
      }
      
      const session = await createSession(user.id);
      
      const player: Player = {
        id: user.id,
        name: user.username,
        isBot: false,
        characterId: "",
      };
      
      state.players.set(user.id, player);
      state.connections.set(socket, { sessionToken: session.token, userId: user.id, playerId: user.id });
      await upsertPlayerProfile(player, null);
      
      sendMessage(socket, { type: "auth_ok", player, sessionToken: session.token });
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
      
      await updateUserLastLogin(user.id);
      await updateSessionLastSeen(session.token);
      
      const stored = await state.db.get<PlayerRow>(
        "SELECT id, name, character_id, lobby_id, is_bot FROM players WHERE id = ?",
        user.id
      );
      
      const player: Player = {
        id: user.id,
        name: user.username,
        isBot: false,
        characterId: stored?.character_id ?? "",
      };
      
      if (stored?.character_id) {
        const storedCharacter = await loadCharacterById(stored.character_id);
        if (storedCharacter) {
          player.characterId = storedCharacter.id;
          state.playerCharacters.set(player.id, storedCharacter);
        }
      }
      
      state.players.set(user.id, player);
      state.connections.set(socket, { sessionToken: session.token, userId: user.id, playerId: user.id });
      await upsertPlayerProfile(player, session.lobbyId);
      
      sendMessage(socket, { type: "auth_ok", player, sessionToken: session.token });

      if (session.lobbyId) {
        const lobby = state.lobbies.get(session.lobbyId);
        if (lobby) {
          if (!lobby.players.find((existing) => existing.id === player.id)) {
            lobby.players.push(player);
          }
          state.connections.set(socket, { sessionToken: session.token, userId: user.id, playerId: player.id, lobbyId: lobby.id });
          await persistLobbyState(lobby);
          sendToLobby(lobby, { type: "lobby_joined", lobbyId: lobby.id, players: lobby.players });
          
          const match = state.matches.get(lobby.id);
          if (match) {
            if (match.status === "paused" && match.pausedForPlayerId === player.id) {
              const resumedMatch: MatchState = {
                ...match,
                status: "active",
                pausedForPlayerId: undefined,
                log: [...match.log, `${player.name} reconnected. Match resumed.`],
              };
              state.matches.set(lobby.id, resumedMatch);
              await upsertMatch(lobby.id, resumedMatch);
              sendToLobby(lobby, { type: "match_resumed", playerId: player.id, playerName: player.name });
              sendToLobby(lobby, { type: "match_state", state: resumedMatch });
              scheduleBotTurn(lobby, resumedMatch);
            } else {
              sendToLobby(lobby, { type: "player_reconnected", playerId: player.id, playerName: player.name });
              sendMessage(socket, { type: "match_state", state: match });
            }
          }
        }
      }
      return;
    }
    case "list_lobbies": {
      sendMessage(socket, { type: "lobbies", lobbies: Array.from(state.lobbies.values()).map(summarizeLobby) });
      return;
    }
    case "create_lobby": {
      const player = requirePlayer(socket);
      if (!player) return;
      const connState = state.connections.get(socket);
      const lobbyId = randomUUID();
      const lobby: Lobby = {
        id: lobbyId,
        name: message.name,
        maxPlayers: message.maxPlayers,
        players: [player],
        status: "open",
      };
      state.lobbies.set(lobbyId, lobby);
      state.connections.set(socket, { ...connState, playerId: player.id, lobbyId });
      if (connState?.sessionToken) {
        await updateSessionLastSeen(connState.sessionToken, lobbyId);
      }
      await persistLobbyState(lobby);
      broadcastLobbies(wss);
      sendToLobby(lobby, { type: "lobby_joined", lobbyId, players: lobby.players });
      return;
    }
    case "join_lobby": {
      const player = requirePlayer(socket);
      if (!player) return;
      const connState = state.connections.get(socket);
      const lobby = findLobbyByIdOrPrefix(message.lobbyId);
      if (!lobby) {
        sendMessage(socket, { type: "error", message: "Lobby not available." });
        return;
      }
      if (lobby.status === "open") {
        if (lobby.players.some(p => p.id === player.id)) {
          state.connections.set(socket, { ...connState, playerId: player.id, lobbyId: lobby.id });
          sendMessage(socket, { type: "lobby_joined", lobbyId: lobby.id, players: lobby.players });
          return;
        }
        if (lobby.players.length >= lobby.maxPlayers) {
          sendMessage(socket, { type: "error", message: "Lobby is full." });
          return;
        }
        lobby.players.push(player);
        state.connections.set(socket, { ...connState, playerId: player.id, lobbyId: lobby.id });
        if (connState?.sessionToken) {
          await updateSessionLastSeen(connState.sessionToken, lobby.id);
        }
        await persistLobbyState(lobby);
        broadcastLobbies(wss);
        sendToLobby(lobby, { type: "lobby_joined", lobbyId: lobby.id, players: lobby.players });
        return;
      }
      state.connections.set(socket, { ...connState, playerId: player.id, lobbyId: lobby.id });
      if (connState?.sessionToken) {
        await updateSessionLastSeen(connState.sessionToken, lobby.id);
      }
      await upsertPlayerProfile(player, lobby.id);
      sendMessage(socket, { type: "lobby_joined", lobbyId: lobby.id, players: lobby.players });
      const match = state.matches.get(lobby.id);
      if (match) {
        if (match.status === "paused" && match.pausedForPlayerId === player.id) {
          const resumedMatch: MatchState = {
            ...match,
            status: "active",
            pausedForPlayerId: undefined,
            log: [...match.log, `${player.name} reconnected. Match resumed.`],
          };
          state.matches.set(lobby.id, resumedMatch);
          await upsertMatch(lobby.id, resumedMatch);
          sendToLobby(lobby, { type: "match_resumed", playerId: player.id, playerName: player.name });
          sendToLobby(lobby, { type: "match_state", state: resumedMatch });
          scheduleBotTurn(lobby, resumedMatch);
        } else {
          sendMessage(socket, { type: "match_state", state: match });
        }
      }
      return;
    }
    case "leave_lobby": {
      await leaveLobby(socket, wss, true);
      return;
    }
    case "delete_lobby": {
      const player = requirePlayer(socket);
      if (!player) return;
      const lobbyToDelete = state.lobbies.get(message.lobbyId);
      if (!lobbyToDelete) {
        sendMessage(socket, { type: "error", message: "Lobby not found." });
        return;
      }
      for (const lobbyPlayer of lobbyToDelete.players) {
        await upsertPlayerProfile(lobbyPlayer, null);
      }
      state.lobbies.delete(message.lobbyId);
      state.matches.delete(message.lobbyId);
      await deleteLobby(message.lobbyId);
      const connState = state.connections.get(socket);
      if (connState?.lobbyId === message.lobbyId) {
        state.connections.set(socket, { playerId: connState.playerId });
      }
      broadcastLobbies(wss);
      return;
    }
    case "select_character": {
      const player = requirePlayer(socket);
      if (!player) return;
      state.playerCharacters.set(player.id, message.character);
      player.characterId = message.character.id;
      state.players.set(player.id, player);
      await upsertCharacter(message.character);
      const connState = state.connections.get(socket);
      await upsertPlayerProfile(player, connState?.lobbyId ?? null);
      return;
    }
    case "start_match": {
      const player = requirePlayer(socket);
      if (!player) return;
      const connState = state.connections.get(socket);
      const lobby = connState?.lobbyId ? state.lobbies.get(connState.lobbyId) : undefined;
      if (!lobby) {
        sendMessage(socket, { type: "error", message: "Lobby not found." });
        return;
      }
      
      const { addBotToLobby } = await import("./bot");
      const requestedBots = message.botCount ?? 0;
      const maxBots = lobby.maxPlayers - lobby.players.length;
      const botsToAdd = Math.min(Math.max(0, requestedBots), maxBots);
      
      for (let i = 0; i < botsToAdd; i++) {
        await addBotToLobby(lobby);
      }
      
      if (lobby.players.length < 2) {
        sendMessage(socket, { type: "error", message: "Need at least 2 players to start." });
        return;
      }
      
      lobby.status = "in_match";
      const matchState = createMatchState(lobby);
      state.matches.set(lobby.id, matchState);
      await persistLobbyState(lobby);
      await upsertMatch(lobby.id, matchState);
      broadcastLobbies(wss);
      sendToLobby(lobby, { type: "match_state", state: matchState });
      scheduleBotTurn(lobby, matchState);
      return;
    }
    case "action": {
      const player = requirePlayer(socket);
      if (!player) return;
      const connState = state.connections.get(socket);
      const lobby = connState?.lobbyId ? state.lobbies.get(connState.lobbyId) : undefined;
      if (!lobby) {
        sendMessage(socket, { type: "error", message: "Lobby not found." });
        return;
      }
      const match = state.matches.get(lobby.id);
      if (!match) {
        sendMessage(socket, { type: "error", message: "Match not found." });
        return;
      }
      if (match.status === "finished") {
        sendMessage(socket, { type: "error", message: "Match is over." });
        return;
      }
      
      const payload = message.payload as CombatActionPayload | undefined;
      if (!payload || payload.type !== message.action) {
        sendMessage(socket, { type: "error", message: "Invalid action payload." });
        return;
      }
      
      await handleCombatAction(socket, lobby, match, player, payload);
      return;
    }
    default:
      return;
  }
};

const handleCombatAction = async (
  socket: WebSocket,
  lobby: Lobby,
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
      state.matches.set(lobby.id, updated);
      await upsertMatch(lobby.id, updated);
      sendToLobby(lobby, { type: "match_state", state: updated });
    } else if (payload.response === 'follow') {
      const updated: MatchState = {
        ...match,
        log: [...match.log, `${actorChar?.name} follows ${exitingChar?.name}, maintaining close combat.`],
      };
      state.matches.set(lobby.id, updated);
      await upsertMatch(lobby.id, updated);
      sendToLobby(lobby, { type: "match_state", state: updated });
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
      state.matches.set(lobby.id, updated);
      await upsertMatch(lobby.id, updated);
      sendToLobby(lobby, { type: "match_state", state: updated });
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
    state.matches.set(lobby.id, updated);
    await upsertMatch(lobby.id, updated);
    sendToLobby(lobby, { type: "match_state", state: updated });
    return;
  }

  if (payload.type === "defend" && match.pendingDefense?.defenderId === player.id) {
    await resolveDefenseChoice(lobby, match, payload);
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
    state.matches.set(lobby.id, updated);
    await upsertMatch(lobby.id, updated);
    sendToLobby(lobby, { type: "match_state", state: updated });
    return;
  }

  if (!actorCombatant.maneuver) {
    sendMessage(socket, { type: "error", message: "Select a maneuver first." });
    return;
  }

  if (payload.type === "move_step") {
    await handleMoveStep(socket, lobby, match, player, actorCombatant, payload);
    return;
  }

  if (payload.type === "rotate") {
    await handleRotate(socket, lobby, match, player, actorCombatant, payload);
    return;
  }

  if (payload.type === "undo_movement") {
    await handleUndoMovement(socket, lobby, match, player, actorCombatant);
    return;
  }

  if (payload.type === "confirm_movement") {
    await handleConfirmMovement(socket, lobby, match, player, actorCombatant);
    return;
  }

  if (payload.type === "skip_movement") {
    await handleSkipMovement(socket, lobby, match, player, actorCombatant);
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
    
    state.matches.set(lobby.id, updated);
    await upsertMatch(lobby.id, updated);
    sendToLobby(lobby, { type: "match_state", state: updated });
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
    state.matches.set(lobby.id, updated);
    await upsertMatch(lobby.id, updated);
    sendToLobby(lobby, { type: "match_state", state: updated });
    scheduleBotTurn(lobby, updated);
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
    state.matches.set(lobby.id, updated);
    await upsertMatch(lobby.id, updated);
    sendToLobby(lobby, { type: "match_state", state: updated });
    scheduleBotTurn(lobby, updated);
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
    state.matches.set(lobby.id, updated);
    await upsertMatch(lobby.id, updated);
    sendToLobby(lobby, { type: "match_state", state: updated });
    scheduleBotTurn(lobby, updated);
    return;
  }

  if (payload.type === "end_turn") {
    const updated = advanceTurn({
      ...match,
      log: [...match.log, `${player.name} ends their turn.`],
    });
    state.matches.set(lobby.id, updated);
    await upsertMatch(lobby.id, updated);
    sendToLobby(lobby, { type: "match_state", state: updated });
    scheduleBotTurn(lobby, updated);
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
      state.matches.set(lobby.id, updated);
      await upsertMatch(lobby.id, updated);
      sendToLobby(lobby, { type: "match_state", state: updated });
    } else {
      const updated = advanceTurn({
        ...match,
        combatants: updatedCombatants,
        log: [...match.log, `${player.name} changes to ${newPosture} posture.`],
      });
      state.matches.set(lobby.id, updated);
      await upsertMatch(lobby.id, updated);
      sendToLobby(lobby, { type: "match_state", state: updated });
      scheduleBotTurn(lobby, updated);
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
      state.matches.set(lobby.id, updated);
      await upsertMatch(lobby.id, updated);
      sendToLobby(lobby, { type: "match_state", state: updated });
      return;
    }
    
    const updated = advanceTurn({
      ...match,
      combatants: updatedCombatants,
      log: [...match.log, `${player.name} moves to (${payload.position.x}, ${payload.position.z}).`],
    });
    state.matches.set(lobby.id, updated);
    await upsertMatch(lobby.id, updated);
    sendToLobby(lobby, { type: "match_state", state: updated });
    scheduleBotTurn(lobby, updated);
    return;
  }

  if (payload.type === "defend") {
    if (match.pendingDefense && match.pendingDefense.defenderId === player.id) {
      await resolveDefenseChoice(lobby, match, payload);
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
    state.matches.set(lobby.id, updated);
    await upsertMatch(lobby.id, updated);
    sendToLobby(lobby, { type: "match_state", state: updated });
    scheduleBotTurn(lobby, updated);
    return;
  }

  if (payload.type === "attack") {
    await handleAttackAction(socket, lobby, match, player, actorCombatant, payload);
    return;
  }

  if (payload.type === "ready_action") {
    await handleReadyAction(socket, lobby, match, player, actorCombatant, payload);
    return;
  }

  if (payload.type === "enter_close_combat") {
    await handleEnterCloseCombat(socket, lobby, match, player, actorCombatant, payload);
    return;
  }

  if (payload.type === "exit_close_combat") {
    await handleExitCloseCombat(socket, lobby, match, player, actorCombatant);
    return;
  }

  if (payload.type === "grapple") {
    await handleGrapple(socket, lobby, match, player, actorCombatant, payload);
    return;
  }

  if (payload.type === "break_free") {
    await handleBreakFree(socket, lobby, match, player, actorCombatant);
    return;
  }

  sendMessage(socket, { type: "error", message: "Action handling not implemented." });
};
