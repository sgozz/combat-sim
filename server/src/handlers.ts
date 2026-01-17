import { randomUUID } from "node:crypto";
import { WebSocket, WebSocketServer } from "ws";
import type {
  CharacterSheet,
  ClientToServerMessage,
  CombatActionPayload,
  MatchState,
  Player,
  HexCoord,
  TurnMovementState,
  PendingDefense,
  DefenseType,
  DamageType,
  EquippedItem,
  EquipmentSlot,
  ReadyAction,
  WaitTrigger,
  CombatantState,
} from "../../shared/types";
import type { Reach } from "../../shared/types";
import { 
  advanceTurn, 
  resolveAttack, 
  resolveAttackRoll,
  resolveDefenseRoll,
  calculateDefenseValue,
  rollDamage,
  getDefenseOptions, 
  getRangePenalty, 
  applyDamageMultiplier, 
  getPostureModifiers, 
  rollHTCheck,
  canAttackAtDistance,
  getCloseCombatAttackModifiers,
  getCloseCombatDefenseModifiers,
  quickContest,
  resolveGrappleAttempt,
  resolveBreakFree,
  resolveGrappleTechnique,
  parseReach,
  initializeTurnMovement,
  calculateReachableHexesInfo,
  gridToHex,
  hexToGrid,
  executeMove,
  executeRotation,
  getRotationCost,
  getHitLocationPenalty,
  getHitLocationWoundingMultiplier,
  calculateEncumbrance,
} from "../../shared/rules";
import type { HexPosition, MovementState } from "../../shared/rules";
import type { Lobby, PlayerRow } from "./types";
import { state } from "./state";
import { 
  loadCharacterById, 
  upsertCharacter, 
  upsertPlayerProfile, 
  upsertMatch, 
  persistLobbyState,
  deleteLobby,
} from "./db";
import { 
  sendMessage, 
  sendToLobby, 
  requirePlayer, 
  summarizeLobby,
  broadcast,
  calculateHexDistance, 
  getCombatantByPlayerId, 
  getCharacterById,
  calculateFacing,
  findFreeAdjacentHex,
  findRetreatHex,
  checkVictory,
} from "./helpers";
import { broadcastLobbies, leaveLobby } from "./lobby";
import { createMatchState } from "./match";
import { ensureMinimumBots, scheduleBotTurn } from "./bot";

const formatRoll = (r: { target: number, roll: number, success: boolean, margin: number, dice: number[] }, label: string) => 
  `(${label} ${r.target} vs ${r.roll} [${r.dice.join(', ')}]: ${r.success ? 'Made' : 'Missed'} by ${Math.abs(r.margin)})`;

const DEFENSE_TIMEOUT_MS = 15000;

type WaitTriggerResult = {
  triggered: boolean;
  waiter: CombatantState | null;
  waiterId: string | null;
};

const checkWaitTriggers = (
  match: MatchState,
  actingPlayerId: string,
  triggerType: 'move' | 'attack',
  newPosition?: { x: number; y: number; z: number },
  attackTargetId?: string
): WaitTriggerResult => {
  const actingCombatant = match.combatants.find(c => c.playerId === actingPlayerId);
  if (!actingCombatant) return { triggered: false, waiter: null, waiterId: null };
  
  for (const combatant of match.combatants) {
    if (combatant.playerId === actingPlayerId) continue;
    if (!combatant.waitTrigger) continue;
    
    const trigger = combatant.waitTrigger;
    const waiterPos = combatant.position;
    const actorPos = newPosition ?? actingCombatant.position;
    const distance = calculateHexDistance(waiterPos, actorPos);
    
    let shouldTrigger = false;
    
    switch (trigger.condition) {
      case 'enemy_moves_adjacent':
        if (triggerType === 'move' && distance <= 1) {
          shouldTrigger = true;
        }
        break;
      case 'enemy_enters_reach':
        if (triggerType === 'move' && distance <= 2) {
          shouldTrigger = true;
        }
        break;
      case 'enemy_attacks_me':
        if (triggerType === 'attack' && attackTargetId === combatant.playerId) {
          shouldTrigger = true;
        }
        break;
      case 'enemy_attacks_ally':
        if (triggerType === 'attack' && attackTargetId !== combatant.playerId) {
          shouldTrigger = true;
        }
        break;
    }
    
    if (shouldTrigger) {
      return { triggered: true, waiter: combatant, waiterId: combatant.playerId };
    }
  }
  
  return { triggered: false, waiter: null, waiterId: null };
};

type ApplyDamageResult = {
  updatedCombatants: MatchState['combatants'];
  finalDamage: number;
  logEntry: string;
  fellUnconscious: boolean;
};

const applyDamageToTarget = (
  match: MatchState,
  targetPlayerId: string,
  baseDamage: number,
  damageFormula: string,
  damageType: DamageType,
  hitLocation: string,
  damageRolls: number[],
  damageModifier: number,
): ApplyDamageResult => {
  const targetCombatant = match.combatants.find(c => c.playerId === targetPlayerId);
  const targetCharacter = match.characters.find(c => c.id === targetCombatant?.characterId);
  
  if (!targetCombatant || !targetCharacter) {
    return { updatedCombatants: match.combatants, finalDamage: 0, logEntry: '', fellUnconscious: false };
  }

  const baseMultDamage = applyDamageMultiplier(baseDamage, damageType);
  const hitLocMultiplier = getHitLocationWoundingMultiplier(hitLocation as Parameters<typeof getHitLocationWoundingMultiplier>[0], damageType);
  const finalDamage = Math.floor(baseMultDamage * hitLocMultiplier);
  
  const rolls = damageRolls.join(',');
  const mod = damageModifier !== 0 ? (damageModifier > 0 ? `+${damageModifier}` : `${damageModifier}`) : '';
  const typeMultStr = damageType === 'cutting' ? 'x1.5' : damageType === 'impaling' ? 'x2' : '';
  const hitLocStr = hitLocMultiplier > 1 ? ` ${hitLocation} x${hitLocMultiplier}` : ` ${hitLocation}`;
  const dmgDetail = typeMultStr 
    ? `(${damageFormula}: [${rolls}]${mod} = ${baseDamage} ${damageType} ${typeMultStr}${hitLocStr} = ${finalDamage})`
    : `(${damageFormula}: [${rolls}]${mod} ${damageType}${hitLocStr} = ${finalDamage})`;

  const targetMaxHP = targetCharacter.derived.hitPoints;
  const targetHT = targetCharacter.attributes.health;
  
  let fellUnconscious = false;
  const updatedCombatants = match.combatants.map((combatant) => {
    if (combatant.playerId !== targetPlayerId) return combatant;
    const newHP = combatant.currentHP - finalDamage;
    const wasAboveZero = combatant.currentHP > 0;
    const nowAtOrBelowZero = newHP <= 0;
    
    let effects = [...combatant.statusEffects];
    
    if (wasAboveZero && nowAtOrBelowZero && !effects.includes('unconscious')) {
      const htCheck = rollHTCheck(targetHT, newHP, targetMaxHP);
      if (!htCheck.success) {
        effects = [...effects, 'unconscious'];
        fellUnconscious = true;
      }
    }
    
    const newShock = finalDamage > 0 ? Math.min(4, combatant.shockPenalty + finalDamage) : combatant.shockPenalty;
    
    return { ...combatant, currentHP: newHP, statusEffects: effects, shockPenalty: newShock };
  });

  return { updatedCombatants, finalDamage, logEntry: dmgDetail, fellUnconscious };
};

export const handleMessage = async (
  socket: WebSocket,
  wss: WebSocketServer,
  message: ClientToServerMessage
): Promise<void> => {
  switch (message.type) {
    case "auth": {
      const stored = await state.db.get<PlayerRow>(
        "SELECT id, name, character_id, lobby_id, is_bot FROM players WHERE name = ?",
        message.name
      );
      const playerId = stored?.id ?? randomUUID();
      const player: Player = {
        id: playerId,
        name: message.name,
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
      state.players.set(playerId, player);
      state.connections.set(socket, { playerId });
      await upsertPlayerProfile(player, stored?.lobby_id ?? null);
      sendMessage(socket, { type: "auth_ok", player });

      if (stored?.lobby_id) {
        const lobby = state.lobbies.get(stored.lobby_id);
        if (lobby) {
          if (!lobby.players.find((existing) => existing.id === player.id)) {
            lobby.players.push(player);
          }
          state.connections.set(socket, { playerId: player.id, lobbyId: lobby.id });
          await persistLobbyState(lobby);
          sendToLobby(lobby, { type: "lobby_joined", lobbyId: lobby.id, players: lobby.players });
          const match = state.matches.get(lobby.id);
          if (match) {
            sendMessage(socket, { type: "match_state", state: match });
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
      const lobbyId = randomUUID();
      const lobby: Lobby = {
        id: lobbyId,
        name: message.name,
        maxPlayers: message.maxPlayers,
        players: [player],
        status: "open",
      };
      state.lobbies.set(lobbyId, lobby);
      state.connections.set(socket, { playerId: player.id, lobbyId });
      await persistLobbyState(lobby);
      broadcastLobbies(wss);
      sendToLobby(lobby, { type: "lobby_joined", lobbyId, players: lobby.players });
      return;
    }
    case "join_lobby": {
      const player = requirePlayer(socket);
      if (!player) return;
      const lobby = state.lobbies.get(message.lobbyId);
      if (!lobby) {
        sendMessage(socket, { type: "error", message: "Lobby not available." });
        return;
      }
      if (lobby.status === "open") {
        if (lobby.players.length >= lobby.maxPlayers) {
          sendMessage(socket, { type: "error", message: "Lobby is full." });
          return;
        }
        lobby.players.push(player);
        state.connections.set(socket, { playerId: player.id, lobbyId: lobby.id });
        await persistLobbyState(lobby);
        broadcastLobbies(wss);
        sendToLobby(lobby, { type: "lobby_joined", lobbyId: lobby.id, players: lobby.players });
        return;
      }
      state.connections.set(socket, { playerId: player.id, lobbyId: lobby.id });
      await upsertPlayerProfile(player, lobby.id);
      sendMessage(socket, { type: "lobby_joined", lobbyId: lobby.id, players: lobby.players });
      const match = state.matches.get(lobby.id);
      if (match) {
        sendMessage(socket, { type: "match_state", state: match });
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
      await ensureMinimumBots(lobby);
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
      
      await handleCombatAction(socket, wss, lobby, match, player, payload);
      return;
    }
    default:
      return;
  }
};

const handleCombatAction = async (
  socket: WebSocket,
  wss: WebSocketServer,
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
  
  // Surrender can be done at any time, even when not your turn
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
    const updatedCombatants = match.combatants.map((c) =>
      c.playerId === player.id ? { ...c, posture: newPosture } : c
    );
    const updated = advanceTurn({
      ...match,
      combatants: updatedCombatants,
      log: [...match.log, `${player.name} changes to ${newPosture} posture.`],
    });
    state.matches.set(lobby.id, updated);
    await upsertMatch(lobby.id, updated);
    sendToLobby(lobby, { type: "match_state", state: updated });
    scheduleBotTurn(lobby, updated);
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
    
    // These maneuvers allow action after movement - don't end turn
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

const handleAttackAction = async (
  socket: WebSocket,
  lobby: Lobby,
  match: MatchState,
  player: Player,
  actorCombatant: ReturnType<typeof getCombatantByPlayerId>,
  payload: CombatActionPayload & { type: "attack" }
): Promise<void> => {
  if (!actorCombatant) return;
  
  if (actorCombatant.inCloseCombatWith && actorCombatant.inCloseCombatWith !== payload.targetId) {
    sendMessage(socket, { type: "error", message: "In close combat - can only attack your close combat opponent." });
    return;
  }
  
  const targetCombatant = match.combatants.find(
    (combatant) => combatant.playerId === payload.targetId
  );
  if (!targetCombatant) {
    sendMessage(socket, { type: "error", message: "Target not found." });
    return;
  }
  const distance = calculateHexDistance(actorCombatant.position, targetCombatant.position);
  const attackerCharacter = getCharacterById(match, actorCombatant.characterId);
  const targetCharacter = getCharacterById(match, targetCombatant.characterId);
  if (!attackerCharacter || !targetCharacter) {
    sendMessage(socket, { type: "error", message: "Character not found." });
    return;
  }
  
  const readyWeapon = actorCombatant.equipped.find(e => e.ready && (e.slot === 'right_hand' || e.slot === 'left_hand'));
  const weapon = readyWeapon 
    ? attackerCharacter.equipment.find(eq => eq.id === readyWeapon.equipmentId)
    : attackerCharacter.equipment[0];
  
  if (!weapon) {
    sendMessage(socket, { type: "error", message: "No weapon available." });
    return;
  }
  
  if (readyWeapon === undefined && actorCombatant.equipped.length > 0) {
    sendMessage(socket, { type: "error", message: "No ready weapon - use Ready maneuver to draw a weapon first." });
    return;
  }
  
  const isRanged = weapon.type === 'ranged';
  const weaponReach: Reach = weapon.reach ?? '1';
  
  if (!isRanged && !canAttackAtDistance(weaponReach, distance)) {
    const { max } = parseReach(weaponReach);
    sendMessage(socket, { type: "error", message: `Target out of melee range (reach ${max}).` });
    return;
  }
  
  const closeCombatMods = getCloseCombatAttackModifiers(weapon ?? { id: '', name: 'Fist', type: 'melee', reach: 'C' }, distance);
  if (!closeCombatMods.canAttack) {
    sendMessage(socket, { type: "error", message: closeCombatMods.reason });
    return;
  }
  
  let skill = attackerCharacter.skills[0]?.level ?? attackerCharacter.attributes.dexterity;
  const attackerManeuver = actorCombatant.maneuver;
  
  if (isRanged) {
    const rangePenalty = getRangePenalty(distance);
    skill += rangePenalty;
  }
  
  skill += closeCombatMods.toHit;
  
  if (attackerManeuver === 'all_out_attack') {
    if (actorCombatant.aoaVariant === 'determined') {
      skill += 4;
    }
  } else if (attackerManeuver === 'move_and_attack') {
    skill = Math.min(skill - 4, 9);
  }
  
  if (actorCombatant.aimTurns > 0 && actorCombatant.aimTargetId === payload.targetId) {
    const weaponAcc = weapon?.accuracy ?? 0;
    const aimBonus = weaponAcc + Math.min(actorCombatant.aimTurns - 1, 2);
    skill += aimBonus;
  }
  
  if (actorCombatant.evaluateBonus > 0 && actorCombatant.evaluateTargetId === payload.targetId) {
    skill += actorCombatant.evaluateBonus;
  }
  
  if (actorCombatant.shockPenalty > 0) {
    skill -= actorCombatant.shockPenalty;
  }
  
  const deceptiveLevel = payload.deceptiveLevel ?? 0;
  if (deceptiveLevel > 0) {
    skill -= deceptiveLevel * 2;
  }
  
  const attackerPosture = getPostureModifiers(actorCombatant.posture);
  skill += isRanged ? attackerPosture.toHitRanged : attackerPosture.toHitMelee;
  
  const hitLocation = payload.hitLocation ?? 'torso';
  const hitLocationPenalty = getHitLocationPenalty(hitLocation);
  skill += hitLocationPenalty;
  
  const targetFacing = targetCombatant.facing;
  const attackDirection = calculateFacing(targetCombatant.position, actorCombatant.position);
  const relativeDir = (attackDirection - targetFacing + 6) % 6;

  let canDefend = true;
  let defenseDescription = "normal";

  if (relativeDir === 3) {
    canDefend = false;
    defenseDescription = "backstab (no defense)";
  } else if (relativeDir === 2 || relativeDir === 4) {
    defenseDescription = "flank (-2)";
  }

  const targetManeuver = targetCombatant.maneuver;
  
  if (targetManeuver === 'all_out_defense' && targetCombatant.aodVariant) {
    const variantLabel = targetCombatant.aodVariant.replace('increased_', '+2 ').replace('_', ' ');
    defenseDescription += defenseDescription === "normal" ? `AoD (${variantLabel})` : ` + AoD (${variantLabel})`;
  }
  
  if (targetManeuver === 'all_out_attack') {
    canDefend = false;
    defenseDescription = "target in AoA (no defense)";
  }
  
  if (targetCombatant.statusEffects.includes('defending')) {
    defenseDescription += defenseDescription === "normal" ? "defensive (+1)" : " + defensive (+1)";
  }

  const attackRoll = resolveAttackRoll(skill);
  const hitLocLabel = hitLocation === 'torso' ? '' : ` [${hitLocation.replace('_', ' ')}]`;
  let logEntry = `${attackerCharacter.name} attacks ${targetCharacter.name}${hitLocLabel} (${defenseDescription})`;

  if (!attackRoll.hit) {
    logEntry += `: Miss. ${formatRoll(attackRoll.roll, 'Skill')}`;
    sendToLobby(lobby, { 
      type: "visual_effect", 
      effect: { type: "miss", targetId: targetCombatant.playerId, position: targetCombatant.position } 
    });
    
    const isDoubleAttack = attackerManeuver === 'all_out_attack' && actorCombatant.aoaVariant === 'double';
    const remainingAttacks = isDoubleAttack ? actorCombatant.attacksRemaining - 1 : 0;
    
    if (remainingAttacks > 0) {
      const updatedCombatants = match.combatants.map(c => 
        c.playerId === player.id ? { ...c, attacksRemaining: remainingAttacks } : c
      );
      const updated: MatchState = {
        ...match,
        combatants: updatedCombatants,
        log: [...match.log, logEntry, `${attackerCharacter.name} has ${remainingAttacks} attack(s) remaining.`],
      };
      state.matches.set(lobby.id, updated);
      await upsertMatch(lobby.id, updated);
      sendToLobby(lobby, { type: "match_state", state: updated });
    } else {
      let updated = advanceTurn({ ...match, log: [...match.log, logEntry] });
      updated = checkVictory(updated);
      state.matches.set(lobby.id, updated);
      await upsertMatch(lobby.id, updated);
      sendToLobby(lobby, { type: "match_state", state: updated });
      scheduleBotTurn(lobby, updated);
    }
    return;
  }

  const damageFormula = weapon?.damage ?? "1d";
  const damageType: DamageType = weapon?.damageType ?? 'crushing';

  if (attackRoll.critical || !canDefend) {
    const dmg = rollDamage(damageFormula);
    let baseDamage = dmg.total;
    if (attackerManeuver === 'all_out_attack' && actorCombatant.aoaVariant === 'strong') {
      baseDamage += 2;
    }
    
    const result = applyDamageToTarget(
      match, targetCombatant.playerId, baseDamage, damageFormula, 
      damageType, hitLocation, dmg.rolls, dmg.modifier
    );
    
    const critStr = attackRoll.critical ? 'Critical hit! ' : '';
    const noDefStr = !canDefend && !attackRoll.critical ? `${defenseDescription}. ` : '';
    logEntry += `: ${critStr}${noDefStr}Hit for ${result.finalDamage} damage ${result.logEntry}. ${formatRoll(attackRoll.roll, 'Attack')}`;
    if (result.fellUnconscious) {
      logEntry += ` ${targetCharacter.name} falls unconscious!`;
    }
    
    sendToLobby(lobby, { 
      type: "visual_effect", 
      effect: { type: "damage", targetId: targetCombatant.playerId, value: result.finalDamage, position: targetCombatant.position } 
    });

    const isDoubleAttack = attackerManeuver === 'all_out_attack' && actorCombatant.aoaVariant === 'double';
    const remainingAttacks = isDoubleAttack ? actorCombatant.attacksRemaining - 1 : 0;
    
    if (remainingAttacks > 0) {
      const updatedCombatants = result.updatedCombatants.map(c => 
        c.playerId === player.id ? { ...c, attacksRemaining: remainingAttacks } : c
      );
      const updated: MatchState = {
        ...match,
        combatants: updatedCombatants,
        log: [...match.log, logEntry, `${attackerCharacter.name} has ${remainingAttacks} attack(s) remaining.`],
      };
      const checkedUpdate = checkVictory(updated);
      state.matches.set(lobby.id, checkedUpdate);
      await upsertMatch(lobby.id, checkedUpdate);
      sendToLobby(lobby, { type: "match_state", state: checkedUpdate });
      if (checkedUpdate.status === 'finished') {
        scheduleBotTurn(lobby, checkedUpdate);
      }
    } else {
      let updated = advanceTurn({
        ...match,
        combatants: result.updatedCombatants,
        log: [...match.log, logEntry],
      });
      updated = checkVictory(updated);
      state.matches.set(lobby.id, updated);
      await upsertMatch(lobby.id, updated);
      sendToLobby(lobby, { type: "match_state", state: updated });
      scheduleBotTurn(lobby, updated);
    }
    return;
  }

  const targetPlayer = lobby.players.find(p => p.id === targetCombatant.playerId);
  const isDefenderBot = targetPlayer?.isBot ?? false;

  if (isDefenderBot) {
    const targetEncumbrance = calculateEncumbrance(
      targetCharacter.attributes.strength,
      targetCharacter.equipment
    );
    const effectiveDodge = targetCharacter.derived.dodge + targetEncumbrance.dodgePenalty;
    const defenseOptions = getDefenseOptions(targetCharacter, effectiveDodge);
    const targetWeapon = targetCharacter.equipment.find(e => e.type === 'melee');
    const targetShield = targetCharacter.equipment.find(e => e.type === 'shield');
    const inCloseCombat = distance === 0;
    const ccDefMods = getCloseCombatDefenseModifiers(
      targetWeapon?.reach,
      targetShield?.shieldSize,
      inCloseCombat
    );
    
    let defenseMod = 0;
    if (relativeDir === 2 || relativeDir === 4) defenseMod = -2;
    if (targetCombatant.statusEffects.includes('defending')) defenseMod += 1;
    
    const targetPosture = getPostureModifiers(targetCombatant.posture);
    const postureDefBonus = isRanged ? targetPosture.defenseVsRanged : targetPosture.defenseVsMelee;
    defenseMod += postureDefBonus;
    
    const aodVariant = targetCombatant.aodVariant;
    const dodgeAodBonus = (targetManeuver === 'all_out_defense' && aodVariant === 'increased_dodge') ? 2 : 0;
    const parryAodBonus = (targetManeuver === 'all_out_defense' && aodVariant === 'increased_parry') ? 2 : 0;
    const blockAodBonus = (targetManeuver === 'all_out_defense' && aodVariant === 'increased_block') ? 2 : 0;
    
    let bestDefense = defenseOptions.dodge + ccDefMods.dodge + defenseMod + dodgeAodBonus;
    let defenseUsed: DefenseType = 'dodge';
    let defenseLabel = "Dodge";
    let botParryWeaponName: string | null = null;
    
    if (ccDefMods.canParry && defenseOptions.parry) {
      const parryWeapon = defenseOptions.parry.weapon;
      const isSameWeaponParry = targetCombatant.parryWeaponsUsedThisTurn.includes(parryWeapon);
      const sameWeaponPenalty = isSameWeaponParry ? -4 : 0;
      const multiDefPenalty = isSameWeaponParry 
        ? (targetCombatant.defensesThisTurn > 1 ? -(targetCombatant.defensesThisTurn - 1) : 0)
        : -targetCombatant.defensesThisTurn;
      const parryValue = defenseOptions.parry.value + ccDefMods.parry + defenseMod + parryAodBonus + sameWeaponPenalty + multiDefPenalty;
      if (parryValue > bestDefense) {
        bestDefense = parryValue;
        defenseUsed = 'parry';
        defenseLabel = `Parry (${parryWeapon})`;
        botParryWeaponName = parryWeapon;
      }
    }
    if (ccDefMods.canBlock && defenseOptions.block) {
      const blockValue = defenseOptions.block.value + ccDefMods.block + defenseMod + blockAodBonus - targetCombatant.defensesThisTurn;
      if (blockValue > bestDefense) {
        bestDefense = blockValue;
        defenseUsed = 'block';
        defenseLabel = `Block (${defenseOptions.block.shield})`;
        botParryWeaponName = null;
      }
    }
    
    const wantsRetreat = !targetCombatant.retreatedThisTurn;
    const retreatHex = wantsRetreat ? findRetreatHex(targetCombatant.position, actorCombatant.position, match.combatants) : null;
    const canRetreat = wantsRetreat && retreatHex !== null;
    const retreatBonus = canRetreat ? (defenseUsed === 'dodge' ? 3 : 1) : 0;
    const finalDefenseValue = bestDefense + retreatBonus;
    
    const defenseRoll = resolveDefenseRoll(finalDefenseValue);
    
    if (defenseRoll.defended) {
      const retreatStr = canRetreat ? ' (with retreat)' : '';
      logEntry += `: ${defenseLabel}${retreatStr}! ${formatRoll(attackRoll.roll, 'Attack')} -> ${formatRoll(defenseRoll.roll, defenseLabel)}`;
      sendToLobby(lobby, { 
        type: "visual_effect", 
        effect: { type: "defend", targetId: targetCombatant.playerId, position: targetCombatant.position } 
      });
      
      let updatedCombatants = match.combatants.map(c => {
        if (c.playerId !== targetCombatant.playerId) return c;
        const newParryWeapons = botParryWeaponName && !c.parryWeaponsUsedThisTurn.includes(botParryWeaponName)
          ? [...c.parryWeaponsUsedThisTurn, botParryWeaponName]
          : c.parryWeaponsUsedThisTurn;
        return { 
          ...c, 
          retreatedThisTurn: canRetreat || c.retreatedThisTurn, 
          defensesThisTurn: c.defensesThisTurn + 1, 
          parryWeaponsUsedThisTurn: newParryWeapons,
          position: retreatHex ?? c.position 
        };
      });
      
      const isDoubleAttack = attackerManeuver === 'all_out_attack' && actorCombatant.aoaVariant === 'double';
      const remainingAttacks = isDoubleAttack ? actorCombatant.attacksRemaining - 1 : 0;
      
      if (remainingAttacks > 0) {
        updatedCombatants = updatedCombatants.map(c => 
          c.playerId === player.id ? { ...c, attacksRemaining: remainingAttacks } : c
        );
        const updated: MatchState = {
          ...match,
          combatants: updatedCombatants,
          log: [...match.log, logEntry, `${attackerCharacter.name} has ${remainingAttacks} attack(s) remaining.`],
        };
        state.matches.set(lobby.id, updated);
        await upsertMatch(lobby.id, updated);
        sendToLobby(lobby, { type: "match_state", state: updated });
      } else {
        let updated = advanceTurn({ ...match, combatants: updatedCombatants, log: [...match.log, logEntry] });
        updated = checkVictory(updated);
        state.matches.set(lobby.id, updated);
        await upsertMatch(lobby.id, updated);
        sendToLobby(lobby, { type: "match_state", state: updated });
        scheduleBotTurn(lobby, updated);
      }
    } else {
      const dmg = rollDamage(damageFormula);
      let baseDamage = dmg.total;
      if (attackerManeuver === 'all_out_attack' && actorCombatant.aoaVariant === 'strong') {
        baseDamage += 2;
      }
      
      const result = applyDamageToTarget(
        match, targetCombatant.playerId, baseDamage, damageFormula,
        damageType, hitLocation, dmg.rolls, dmg.modifier
      );
      
      logEntry += `: Hit for ${result.finalDamage} damage ${result.logEntry}. ${formatRoll(attackRoll.roll, 'Attack')} -> ${formatRoll(defenseRoll.roll, defenseLabel)} Failed`;
      if (result.fellUnconscious) {
        logEntry += ` ${targetCharacter.name} falls unconscious!`;
      }
      
      sendToLobby(lobby, { 
        type: "visual_effect", 
        effect: { type: "damage", targetId: targetCombatant.playerId, value: result.finalDamage, position: targetCombatant.position } 
      });

      const isDoubleAttack = attackerManeuver === 'all_out_attack' && actorCombatant.aoaVariant === 'double';
      const remainingAttacks = isDoubleAttack ? actorCombatant.attacksRemaining - 1 : 0;
      
      if (remainingAttacks > 0) {
        const updatedCombatants = result.updatedCombatants.map(c => 
          c.playerId === player.id ? { ...c, attacksRemaining: remainingAttacks } : c
        );
        const updated: MatchState = {
          ...match,
          combatants: updatedCombatants,
          log: [...match.log, logEntry, `${attackerCharacter.name} has ${remainingAttacks} attack(s) remaining.`],
        };
        const checkedUpdate = checkVictory(updated);
        state.matches.set(lobby.id, checkedUpdate);
        await upsertMatch(lobby.id, checkedUpdate);
        sendToLobby(lobby, { type: "match_state", state: checkedUpdate });
        if (checkedUpdate.status === 'finished') {
          scheduleBotTurn(lobby, checkedUpdate);
        }
      } else {
        let updated = advanceTurn({
          ...match,
          combatants: result.updatedCombatants,
          log: [...match.log, logEntry],
        });
        updated = checkVictory(updated);
        state.matches.set(lobby.id, updated);
        await upsertMatch(lobby.id, updated);
        sendToLobby(lobby, { type: "match_state", state: updated });
        scheduleBotTurn(lobby, updated);
      }
    }
    return;
  }

  const pendingDefense: PendingDefense = {
    attackerId: player.id,
    defenderId: targetCombatant.playerId,
    attackRoll: attackRoll.roll.roll,
    attackMargin: attackRoll.roll.margin,
    hitLocation,
    weapon: weapon?.name ?? 'Unarmed',
    damage: damageFormula,
    damageType,
    deceptivePenalty: deceptiveLevel,
    timestamp: Date.now(),
  };

  logEntry += `: ${formatRoll(attackRoll.roll, 'Attack')} - awaiting defense...`;

  const updated: MatchState = {
    ...match,
    pendingDefense,
    log: [...match.log, logEntry],
  };
  
  state.matches.set(lobby.id, updated);
  await upsertMatch(lobby.id, updated);
  sendToLobby(lobby, { type: "match_state", state: updated });
  
  scheduleDefenseTimeout(lobby.id, pendingDefense, actorCombatant, attackerManeuver);
};

const defenseTimeouts = new Map<string, NodeJS.Timeout>();

const scheduleDefenseTimeout = (
  lobbyId: string,
  pendingDefense: PendingDefense,
  attackerCombatant: ReturnType<typeof getCombatantByPlayerId>,
  attackerManeuver: string | null
) => {
  const existingTimer = defenseTimeouts.get(lobbyId);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }
  
  const timer = setTimeout(async () => {
    defenseTimeouts.delete(lobbyId);
    
    const lobby = state.lobbies.get(lobbyId);
    const match = state.matches.get(lobbyId);
    if (!lobby || !match || !match.pendingDefense) return;
    
    await resolveDefenseChoice(lobby, match, {
      type: 'defend',
      defenseType: 'dodge',
      retreat: false,
      dodgeAndDrop: false,
    });
  }, DEFENSE_TIMEOUT_MS);
  
  defenseTimeouts.set(lobbyId, timer);
};

const resolveDefenseChoice = async (
  lobby: Lobby,
  match: MatchState,
  choice: { type: 'defend'; defenseType: DefenseType; retreat: boolean; dodgeAndDrop: boolean }
): Promise<void> => {
  const pending = match.pendingDefense;
  if (!pending) return;
  
  const existingTimer = defenseTimeouts.get(lobby.id);
  if (existingTimer) {
    clearTimeout(existingTimer);
    defenseTimeouts.delete(lobby.id);
  }
  
  const defenderCombatant = match.combatants.find(c => c.playerId === pending.defenderId);
  const attackerCombatant = match.combatants.find(c => c.playerId === pending.attackerId);
  const defenderCharacter = match.characters.find(c => c.id === defenderCombatant?.characterId);
  const attackerCharacter = match.characters.find(c => c.id === attackerCombatant?.characterId);
  
  if (!defenderCombatant || !attackerCombatant || !defenderCharacter || !attackerCharacter) return;

  if (choice.defenseType === 'none') {
    const dmg = rollDamage(pending.damage);
    let baseDamage = dmg.total;
    if (attackerCombatant.maneuver === 'all_out_attack' && attackerCombatant.aoaVariant === 'strong') {
      baseDamage += 2;
    }
    
    const result = applyDamageToTarget(
      match, pending.defenderId, baseDamage, pending.damage,
      pending.damageType, pending.hitLocation, dmg.rolls, dmg.modifier
    );
    
    const logEntry = `${defenderCharacter.name} does not defend: Hit for ${result.finalDamage} damage ${result.logEntry}${result.fellUnconscious ? ` ${defenderCharacter.name} falls unconscious!` : ''}`;
    
    sendToLobby(lobby, { 
      type: "visual_effect", 
      effect: { type: "damage", targetId: pending.defenderId, value: result.finalDamage, position: defenderCombatant.position } 
    });

    const isDoubleAttack = attackerCombatant.maneuver === 'all_out_attack' && attackerCombatant.aoaVariant === 'double';
    const remainingAttacks = isDoubleAttack ? attackerCombatant.attacksRemaining - 1 : 0;
    
    if (remainingAttacks > 0) {
      const updatedCombatants = result.updatedCombatants.map(c => 
        c.playerId === pending.attackerId ? { ...c, attacksRemaining: remainingAttacks } : c
      );
      const updated: MatchState = {
        ...match,
        combatants: updatedCombatants,
        pendingDefense: undefined,
        log: [...match.log, logEntry, `${attackerCharacter.name} has ${remainingAttacks} attack(s) remaining.`],
      };
      const checkedUpdate = checkVictory(updated);
      state.matches.set(lobby.id, checkedUpdate);
      await upsertMatch(lobby.id, checkedUpdate);
      sendToLobby(lobby, { type: "match_state", state: checkedUpdate });
    } else {
      let updated = advanceTurn({
        ...match,
        combatants: result.updatedCombatants,
        pendingDefense: undefined,
        log: [...match.log, logEntry],
      });
      updated = checkVictory(updated);
      state.matches.set(lobby.id, updated);
      await upsertMatch(lobby.id, updated);
      sendToLobby(lobby, { type: "match_state", state: updated });
      scheduleBotTurn(lobby, updated);
    }
    return;
  }

  const defenderEncumbrance = calculateEncumbrance(
    defenderCharacter.attributes.strength,
    defenderCharacter.equipment
  );
  const effectiveDefenderDodge = defenderCharacter.derived.dodge + defenderEncumbrance.dodgePenalty;
  const defenseOptions = getDefenseOptions(defenderCharacter, effectiveDefenderDodge);
  const distance = calculateHexDistance(attackerCombatant.position, defenderCombatant.position);
  const inCloseCombat = distance === 0;
  const defenderWeapon = defenderCharacter.equipment.find(e => e.type === 'melee');
  const defenderShield = defenderCharacter.equipment.find(e => e.type === 'shield');
  const ccDefMods = getCloseCombatDefenseModifiers(
    defenderWeapon?.reach,
    defenderShield?.shieldSize,
    inCloseCombat
  );
  
  let baseDefense = 0;
  let defenseLabel = '';
  
  let parryWeaponName: string | null = null;
  let sameWeaponParry = false;
  
  switch (choice.defenseType) {
    case 'dodge':
      baseDefense = defenseOptions.dodge + ccDefMods.dodge;
      defenseLabel = 'Dodge';
      break;
    case 'parry':
      if (!defenseOptions.parry || !ccDefMods.canParry) {
        baseDefense = 3;
        defenseLabel = 'Parry (unavailable)';
      } else {
        baseDefense = defenseOptions.parry.value + ccDefMods.parry;
        defenseLabel = `Parry (${defenseOptions.parry.weapon})`;
        parryWeaponName = defenseOptions.parry.weapon;
        sameWeaponParry = defenderCombatant.parryWeaponsUsedThisTurn.includes(parryWeaponName);
      }
      break;
    case 'block':
      if (!defenseOptions.block || !ccDefMods.canBlock) {
        baseDefense = 3;
        defenseLabel = 'Block (unavailable)';
      } else {
        baseDefense = defenseOptions.block.value + ccDefMods.block;
        defenseLabel = `Block (${defenseOptions.block.shield})`;
      }
      break;
  }
  
  const attackerPos = attackerCombatant.position;
  const defenderPos = defenderCombatant.position;
  const attackDirection = calculateFacing(defenderPos, attackerPos);
  const relativeDir = (attackDirection - defenderCombatant.facing + 6) % 6;
  
  let defenseMod = 0;
  if (relativeDir === 2 || relativeDir === 4) defenseMod = -2;
  if (defenderCombatant.statusEffects.includes('defending')) defenseMod += 1;
  
  const aodVariant = defenderCombatant.aodVariant;
  if (defenderCombatant.maneuver === 'all_out_defense' && aodVariant) {
    if ((aodVariant === 'increased_dodge' && choice.defenseType === 'dodge') ||
        (aodVariant === 'increased_parry' && choice.defenseType === 'parry') ||
        (aodVariant === 'increased_block' && choice.defenseType === 'block')) {
      defenseMod += 2;
    }
  }
  
  const isRanged = attackerCharacter.equipment[0]?.type === 'ranged';
  const defenderPosture = getPostureModifiers(defenderCombatant.posture);
  defenseMod += isRanged ? defenderPosture.defenseVsRanged : defenderPosture.defenseVsMelee;
  
  const canRetreat = choice.retreat && !defenderCombatant.retreatedThisTurn;
  
  const finalDefenseValue = calculateDefenseValue(baseDefense, {
    retreat: canRetreat,
    dodgeAndDrop: choice.dodgeAndDrop && choice.defenseType === 'dodge',
    inCloseCombat,
    defensesThisTurn: defenderCombatant.defensesThisTurn,
    deceptivePenalty: pending.deceptivePenalty,
    postureModifier: defenseMod,
    defenseType: choice.defenseType,
    sameWeaponParry,
  });
  
  const defenseRoll = resolveDefenseRoll(finalDefenseValue);
  
  if (defenseRoll.defended) {
    let retreatHex: { x: number; y: number; z: number } | null = null;
    if (canRetreat) {
      retreatHex = findRetreatHex(defenderCombatant.position, attackerCombatant.position, match.combatants);
    }
    
    const retreatStr = canRetreat && retreatHex ? ' (retreat)' : '';
    const dropStr = choice.dodgeAndDrop ? ' (drop)' : '';
    const logEntry = `${defenderCharacter.name} defends with ${defenseLabel}${retreatStr}${dropStr}: ${formatRoll(defenseRoll.roll, defenseLabel)} Success!`;
    
    sendToLobby(lobby, { 
      type: "visual_effect", 
      effect: { type: "defend", targetId: pending.defenderId, position: defenderCombatant.position } 
    });
    
    let updatedCombatants = match.combatants.map(c => {
      if (c.playerId !== pending.defenderId) return c;
      const newParryWeapons = parryWeaponName && !c.parryWeaponsUsedThisTurn.includes(parryWeaponName)
        ? [...c.parryWeaponsUsedThisTurn, parryWeaponName]
        : c.parryWeaponsUsedThisTurn;
      return { 
        ...c, 
        retreatedThisTurn: (canRetreat && retreatHex !== null) || c.retreatedThisTurn, 
        defensesThisTurn: c.defensesThisTurn + 1,
        parryWeaponsUsedThisTurn: newParryWeapons,
        posture: choice.dodgeAndDrop ? 'prone' as const : c.posture,
        position: retreatHex ?? c.position,
      };
    });
    
    const isDoubleAttack = attackerCombatant.maneuver === 'all_out_attack' && attackerCombatant.aoaVariant === 'double';
    const remainingAttacks = isDoubleAttack ? attackerCombatant.attacksRemaining - 1 : 0;
    
    if (remainingAttacks > 0) {
      updatedCombatants = updatedCombatants.map(c => 
        c.playerId === pending.attackerId ? { ...c, attacksRemaining: remainingAttacks } : c
      );
      const updated: MatchState = {
        ...match,
        combatants: updatedCombatants,
        pendingDefense: undefined,
        log: [...match.log, logEntry, `${attackerCharacter.name} has ${remainingAttacks} attack(s) remaining.`],
      };
      state.matches.set(lobby.id, updated);
      await upsertMatch(lobby.id, updated);
      sendToLobby(lobby, { type: "match_state", state: updated });
    } else {
      let updated = advanceTurn({ ...match, combatants: updatedCombatants, pendingDefense: undefined, log: [...match.log, logEntry] });
      updated = checkVictory(updated);
      state.matches.set(lobby.id, updated);
      await upsertMatch(lobby.id, updated);
      sendToLobby(lobby, { type: "match_state", state: updated });
      scheduleBotTurn(lobby, updated);
    }
  } else {
    const dmg = rollDamage(pending.damage);
    let baseDamage = dmg.total;
    if (attackerCombatant.maneuver === 'all_out_attack' && attackerCombatant.aoaVariant === 'strong') {
      baseDamage += 2;
    }
    
    const result = applyDamageToTarget(
      match, pending.defenderId, baseDamage, pending.damage,
      pending.damageType, pending.hitLocation, dmg.rolls, dmg.modifier
    );
    
    const logEntry = `${defenderCharacter.name} fails ${defenseLabel}: ${formatRoll(defenseRoll.roll, defenseLabel)} Failed. Hit for ${result.finalDamage} damage ${result.logEntry}${result.fellUnconscious ? ` ${defenderCharacter.name} falls unconscious!` : ''}`;
    
    sendToLobby(lobby, { 
      type: "visual_effect", 
      effect: { type: "damage", targetId: pending.defenderId, value: result.finalDamage, position: defenderCombatant.position } 
    });

    let updatedCombatants = result.updatedCombatants.map(c => {
      if (c.playerId !== pending.defenderId) return c;
      const newParryWeapons = parryWeaponName && !c.parryWeaponsUsedThisTurn.includes(parryWeaponName)
        ? [...c.parryWeaponsUsedThisTurn, parryWeaponName]
        : c.parryWeaponsUsedThisTurn;
      return { 
        ...c, 
        defensesThisTurn: c.defensesThisTurn + 1,
        parryWeaponsUsedThisTurn: newParryWeapons,
        posture: choice.dodgeAndDrop ? 'prone' as const : c.posture,
      };
    });

    const isDoubleAttack = attackerCombatant.maneuver === 'all_out_attack' && attackerCombatant.aoaVariant === 'double';
    const remainingAttacks = isDoubleAttack ? attackerCombatant.attacksRemaining - 1 : 0;
    
    if (remainingAttacks > 0) {
      updatedCombatants = updatedCombatants.map(c => 
        c.playerId === pending.attackerId ? { ...c, attacksRemaining: remainingAttacks } : c
      );
      const updated: MatchState = {
        ...match,
        combatants: updatedCombatants,
        pendingDefense: undefined,
        log: [...match.log, logEntry, `${attackerCharacter.name} has ${remainingAttacks} attack(s) remaining.`],
      };
      const checkedUpdate = checkVictory(updated);
      state.matches.set(lobby.id, checkedUpdate);
      await upsertMatch(lobby.id, checkedUpdate);
      sendToLobby(lobby, { type: "match_state", state: checkedUpdate });
    } else {
      let updated = advanceTurn({
        ...match,
        combatants: updatedCombatants,
        pendingDefense: undefined,
        log: [...match.log, logEntry],
      });
      updated = checkVictory(updated);
      state.matches.set(lobby.id, updated);
      await upsertMatch(lobby.id, updated);
      sendToLobby(lobby, { type: "match_state", state: updated });
      scheduleBotTurn(lobby, updated);
    }
  }
};

const handleReadyAction = async (
  socket: WebSocket,
  lobby: Lobby,
  match: MatchState,
  player: Player,
  actorCombatant: ReturnType<typeof getCombatantByPlayerId>,
  payload: CombatActionPayload & { type: "ready_action" }
): Promise<void> => {
  if (!actorCombatant) return;
  
  if (actorCombatant.maneuver !== 'ready') {
    sendMessage(socket, { type: "error", message: "Must select Ready maneuver first." });
    return;
  }
  
  const actorCharacter = getCharacterById(match, actorCombatant.characterId);
  if (!actorCharacter) {
    sendMessage(socket, { type: "error", message: "Character not found." });
    return;
  }
  
  const item = actorCharacter.equipment.find(e => e.id === payload.itemId);
  if (!item) {
    sendMessage(socket, { type: "error", message: "Item not found in equipment." });
    return;
  }
  
  const currentEquipped = actorCombatant.equipped;
  let newEquipped: EquippedItem[] = [...currentEquipped];
  let logMsg = '';
  
  switch (payload.action) {
    case 'draw': {
      const alreadyEquipped = currentEquipped.find(e => e.equipmentId === payload.itemId);
      if (alreadyEquipped?.ready) {
        sendMessage(socket, { type: "error", message: "Item already drawn." });
        return;
      }
      
      const targetSlot: EquipmentSlot = payload.targetSlot ?? (item.type === 'shield' ? 'left_hand' : 'right_hand');
      const slotOccupied = currentEquipped.find(e => e.slot === targetSlot && e.ready);
      if (slotOccupied) {
        sendMessage(socket, { type: "error", message: `${targetSlot} is occupied. Sheathe or drop current item first.` });
        return;
      }
      
      if (alreadyEquipped) {
        newEquipped = newEquipped.map(e => 
          e.equipmentId === payload.itemId ? { ...e, slot: targetSlot, ready: true } : e
        );
      } else {
        newEquipped.push({ equipmentId: payload.itemId, slot: targetSlot, ready: true });
      }
      
      logMsg = `${actorCharacter.name} draws ${item.name}.`;
      break;
    }
    
    case 'sheathe': {
      const equippedItem = currentEquipped.find(e => e.equipmentId === payload.itemId);
      if (!equippedItem || !equippedItem.ready) {
        sendMessage(socket, { type: "error", message: "Item not in hand." });
        return;
      }
      
      const storageSlot: EquipmentSlot = payload.targetSlot ?? 'belt';
      newEquipped = newEquipped.map(e =>
        e.equipmentId === payload.itemId ? { ...e, slot: storageSlot, ready: false } : e
      );
      
      logMsg = `${actorCharacter.name} sheathes ${item.name}.`;
      break;
    }
    
    case 'reload': {
      if (item.type !== 'ranged') {
        sendMessage(socket, { type: "error", message: "Can only reload ranged weapons." });
        return;
      }
      logMsg = `${actorCharacter.name} reloads ${item.name}.`;
      break;
    }
    
    case 'prepare':
    case 'pickup': {
      const targetSlot: EquipmentSlot = payload.targetSlot ?? 'right_hand';
      const slotOccupied = currentEquipped.find(e => e.slot === targetSlot && e.ready);
      if (slotOccupied) {
        sendMessage(socket, { type: "error", message: `${targetSlot} is occupied.` });
        return;
      }
      
      newEquipped = newEquipped.filter(e => e.equipmentId !== payload.itemId);
      newEquipped.push({ equipmentId: payload.itemId, slot: targetSlot, ready: true });
      
      logMsg = payload.action === 'pickup' 
        ? `${actorCharacter.name} picks up ${item.name}.`
        : `${actorCharacter.name} prepares ${item.name}.`;
      break;
    }
  }
  
  const updatedCombatants = match.combatants.map(c =>
    c.playerId === player.id ? { ...c, equipped: newEquipped } : c
  );
  
  const updated = advanceTurn({
    ...match,
    combatants: updatedCombatants,
    log: [...match.log, logMsg],
  });
  
  state.matches.set(lobby.id, updated);
  await upsertMatch(lobby.id, updated);
  sendToLobby(lobby, { type: "match_state", state: updated });
  scheduleBotTurn(lobby, updated);
};

const handleEnterCloseCombat = async (
  socket: WebSocket,
  lobby: Lobby,
  match: MatchState,
  player: Player,
  actorCombatant: ReturnType<typeof getCombatantByPlayerId>,
  payload: CombatActionPayload & { type: "enter_close_combat" }
): Promise<void> => {
  if (!actorCombatant) return;
  
  if (actorCombatant.inCloseCombatWith) {
    sendMessage(socket, { type: "error", message: "Already in close combat." });
    return;
  }
  
  const targetCombatant = match.combatants.find(c => c.playerId === payload.targetId);
  if (!targetCombatant) {
    sendMessage(socket, { type: "error", message: "Target not found." });
    return;
  }
  
  if (targetCombatant.inCloseCombatWith && targetCombatant.inCloseCombatWith !== player.id) {
    sendMessage(socket, { type: "error", message: "Target is already in close combat with someone else." });
    return;
  }
  
  const distance = calculateHexDistance(actorCombatant.position, targetCombatant.position);
  if (distance > 1) {
    sendMessage(socket, { type: "error", message: "Must be adjacent to enter close combat." });
    return;
  }
  
  const attackerCharacter = getCharacterById(match, actorCombatant.characterId);
  const targetCharacter = getCharacterById(match, targetCombatant.characterId);
  if (!attackerCharacter || !targetCharacter) {
    sendMessage(socket, { type: "error", message: "Character not found." });
    return;
  }
  
  const attackerSkill = attackerCharacter.skills[0]?.level ?? attackerCharacter.attributes.dexterity;
  const defenderSkill = targetCharacter.skills[0]?.level ?? targetCharacter.attributes.dexterity;
  
  const contest = quickContest(attackerSkill, defenderSkill);
  
  if (contest.attackerWins) {
    const updatedCombatants = match.combatants.map(c => {
      if (c.playerId === player.id) {
        return { ...c, inCloseCombatWith: payload.targetId, closeCombatPosition: 'front' as const, position: targetCombatant.position };
      }
      if (c.playerId === payload.targetId) {
        return { ...c, inCloseCombatWith: player.id, closeCombatPosition: 'front' as const };
      }
      return c;
    });
    
    const logEntry = `${attackerCharacter.name} enters close combat with ${targetCharacter.name}! ${formatRoll(contest.attacker, 'Skill')} vs ${formatRoll(contest.defender, 'Resist')}`;
    
    const updated = advanceTurn({
      ...match,
      combatants: updatedCombatants,
      log: [...match.log, logEntry],
    });
    state.matches.set(lobby.id, updated);
    await upsertMatch(lobby.id, updated);
    sendToLobby(lobby, { 
      type: "visual_effect", 
      effect: { type: "close_combat", attackerId: player.id, targetId: payload.targetId, position: targetCombatant.position } 
    });
    sendToLobby(lobby, { type: "match_state", state: updated });
    scheduleBotTurn(lobby, updated);
  } else {
    const logEntry = `${attackerCharacter.name} fails to enter close combat with ${targetCharacter.name}. ${formatRoll(contest.attacker, 'Skill')} vs ${formatRoll(contest.defender, 'Resist')}`;
    
    const updated = advanceTurn({
      ...match,
      log: [...match.log, logEntry],
    });
    state.matches.set(lobby.id, updated);
    await upsertMatch(lobby.id, updated);
    sendToLobby(lobby, { type: "match_state", state: updated });
    scheduleBotTurn(lobby, updated);
  }
};

const handleExitCloseCombat = async (
  socket: WebSocket,
  lobby: Lobby,
  match: MatchState,
  player: Player,
  actorCombatant: ReturnType<typeof getCombatantByPlayerId>
): Promise<void> => {
  if (!actorCombatant) return;
  
  if (!actorCombatant.inCloseCombatWith) {
    sendMessage(socket, { type: "error", message: "Not in close combat." });
    return;
  }
  
  const opponentId = actorCombatant.inCloseCombatWith;
  const opponent = match.combatants.find(c => c.playerId === opponentId);
  
  const exitHex = findFreeAdjacentHex(actorCombatant.position, match.combatants);
  if (!exitHex) {
    sendMessage(socket, { type: "error", message: "No free hex to exit to." });
    return;
  }
  
  if (!opponent || opponent.usedReaction) {
    const updatedCombatants = match.combatants.map(c => {
      if (c.playerId === player.id) {
        return { ...c, inCloseCombatWith: null, closeCombatPosition: null, position: exitHex };
      }
      if (c.playerId === opponentId) {
        return { ...c, inCloseCombatWith: null, closeCombatPosition: null };
      }
      return c;
    });
    
    const actorChar = getCharacterById(match, actorCombatant.characterId);
    const updated = advanceTurn({
      ...match,
      combatants: updatedCombatants,
      log: [...match.log, `${actorChar?.name} exits close combat.`],
    });
    state.matches.set(lobby.id, updated);
    await upsertMatch(lobby.id, updated);
    sendToLobby(lobby, { type: "match_state", state: updated });
    scheduleBotTurn(lobby, updated);
  } else {
    const opponentPlayer = match.players.find(p => p.id === opponentId);
    if (opponentPlayer?.isBot) {
      const updatedCombatants = match.combatants.map(c => {
        if (c.playerId === player.id) {
          return { ...c, inCloseCombatWith: null, closeCombatPosition: null, position: exitHex };
        }
        if (c.playerId === opponentId) {
          return { ...c, inCloseCombatWith: null, closeCombatPosition: null };
        }
        return c;
      });
      
      const actorChar = getCharacterById(match, actorCombatant.characterId);
      const opponentChar = getCharacterById(match, opponent.characterId);
      const updated = advanceTurn({
        ...match,
        combatants: updatedCombatants,
        log: [...match.log, `${actorChar?.name} exits close combat. ${opponentChar?.name} lets them go.`],
      });
      state.matches.set(lobby.id, updated);
      await upsertMatch(lobby.id, updated);
      sendToLobby(lobby, { type: "match_state", state: updated });
      scheduleBotTurn(lobby, updated);
    } else {
      sendToLobby(lobby, { 
        type: "pending_action", 
        action: { type: 'exit_close_combat_request', exitingId: player.id, targetId: opponentId }
      });
    }
  }
};

const handleGrapple = async (
  socket: WebSocket,
  lobby: Lobby,
  match: MatchState,
  player: Player,
  actorCombatant: ReturnType<typeof getCombatantByPlayerId>,
  payload: CombatActionPayload & { type: "grapple" }
): Promise<void> => {
  if (!actorCombatant) return;
  
  const targetCombatant = match.combatants.find(c => c.playerId === payload.targetId);
  if (!targetCombatant) {
    sendMessage(socket, { type: "error", message: "Target not found." });
    return;
  }
  
  const distance = calculateHexDistance(actorCombatant.position, targetCombatant.position);
  if (distance > 1) {
    sendMessage(socket, { type: "error", message: "Must be adjacent to grapple." });
    return;
  }
  
  const attackerCharacter = getCharacterById(match, actorCombatant.characterId);
  const targetCharacter = getCharacterById(match, targetCombatant.characterId);
  if (!attackerCharacter || !targetCharacter) {
    sendMessage(socket, { type: "error", message: "Character not found." });
    return;
  }
  
  if (payload.action === 'grab') {
    const wrestlingSkill = attackerCharacter.skills.find(s => s.name === 'Wrestling')?.level ?? attackerCharacter.attributes.dexterity;
    const grappleResult = resolveGrappleAttempt(
      attackerCharacter.attributes.dexterity,
      wrestlingSkill,
      targetCharacter.attributes.dexterity,
      true
    );
    
    if (grappleResult.success) {
      const cp = grappleResult.controlPoints;
      const updatedCombatants = match.combatants.map(c => {
        if (c.playerId === player.id) {
          return { 
            ...c, 
            grapple: { grappledBy: c.grapple?.grappledBy ?? null, grappling: payload.targetId, cpSpent: cp, cpReceived: c.grapple?.cpReceived ?? 0 },
            inCloseCombatWith: payload.targetId,
            closeCombatPosition: 'front' as const,
            position: targetCombatant.position
          };
        }
        if (c.playerId === payload.targetId) {
          return { 
            ...c, 
            grapple: { grappledBy: player.id, grappling: c.grapple?.grappling ?? null, cpSpent: c.grapple?.cpSpent ?? 0, cpReceived: cp },
            inCloseCombatWith: player.id,
            closeCombatPosition: 'front' as const
          };
        }
        return c;
      });
      
      let logEntry = `${attackerCharacter.name} grapples ${targetCharacter.name}! (${cp} CP) ${formatRoll(grappleResult.attack, 'Wrestling')}`;
      if (grappleResult.defense) {
        logEntry += ` -> ${formatRoll(grappleResult.defense, 'Defend')}`;
      }
      
      const updated = advanceTurn({
        ...match,
        combatants: updatedCombatants,
        log: [...match.log, logEntry],
      });
      state.matches.set(lobby.id, updated);
      await upsertMatch(lobby.id, updated);
      sendToLobby(lobby, { 
        type: "visual_effect", 
        effect: { type: "grapple", attackerId: player.id, targetId: payload.targetId, position: targetCombatant.position } 
      });
      sendToLobby(lobby, { type: "match_state", state: updated });
      scheduleBotTurn(lobby, updated);
    } else {
      let logEntry = `${attackerCharacter.name} fails to grapple ${targetCharacter.name}. ${formatRoll(grappleResult.attack, 'Wrestling')}`;
      if (grappleResult.defense) {
        logEntry += ` -> ${formatRoll(grappleResult.defense, 'Defend')}`;
      }
      
      const updated = advanceTurn({
        ...match,
        log: [...match.log, logEntry],
      });
      state.matches.set(lobby.id, updated);
      await upsertMatch(lobby.id, updated);
      sendToLobby(lobby, { type: "match_state", state: updated });
      scheduleBotTurn(lobby, updated);
    }
  } else if (payload.action === 'throw' || payload.action === 'lock' || payload.action === 'choke' || payload.action === 'pin') {
    if (!actorCombatant.grapple?.grappling) {
      sendMessage(socket, { type: "error", message: "Must be grappling to use this technique." });
      return;
    }
    
    const techResult = resolveGrappleTechnique(
      payload.action,
      attackerCharacter.skills.find(s => s.name === 'Wrestling')?.level ?? attackerCharacter.attributes.dexterity,
      attackerCharacter.attributes.strength,
      actorCombatant.grapple.cpSpent
    );
    
    if (techResult.success) {
      let updatedCombatants = match.combatants;
      let logEntry = `${attackerCharacter.name} uses ${payload.action} on ${targetCharacter.name}: ${techResult.effect}`;
      
      if (techResult.damage) {
        const dmg = techResult.damage.total;
        updatedCombatants = match.combatants.map(c => {
          if (c.playerId === payload.targetId) {
            return { ...c, currentHP: Math.max(0, c.currentHP - dmg) };
          }
          return c;
        });
        logEntry += ` (${dmg} damage)`;
      }
      
      if (payload.action === 'throw') {
        updatedCombatants = updatedCombatants.map(c => {
          if (c.playerId === payload.targetId) {
            return { 
              ...c, 
              posture: 'prone' as const,
              statusEffects: [...c.statusEffects, 'stunned'],
              grapple: { grappledBy: null, grappling: null, cpSpent: 0, cpReceived: 0 }
            };
          }
          if (c.playerId === player.id) {
            return {
              ...c,
              grapple: { grappledBy: null, grappling: null, cpSpent: 0, cpReceived: 0 },
              inCloseCombatWith: null,
              closeCombatPosition: null
            };
          }
          return c;
        });
      }
      
      const updated = advanceTurn({
        ...match,
        combatants: updatedCombatants,
        log: [...match.log, logEntry],
      });
      state.matches.set(lobby.id, updated);
      await upsertMatch(lobby.id, updated);
      sendToLobby(lobby, { type: "match_state", state: updated });
      scheduleBotTurn(lobby, updated);
    } else {
      const updated = advanceTurn({
        ...match,
        log: [...match.log, `${attackerCharacter.name} fails ${payload.action} attempt.`],
      });
      state.matches.set(lobby.id, updated);
      await upsertMatch(lobby.id, updated);
      sendToLobby(lobby, { type: "match_state", state: updated });
      scheduleBotTurn(lobby, updated);
    }
  } else if (payload.action === 'release') {
    const updatedCombatants = match.combatants.map(c => {
      if (c.playerId === player.id || c.playerId === payload.targetId) {
        return { 
          ...c, 
          grapple: { grappledBy: null, grappling: null, cpSpent: 0, cpReceived: 0 },
          inCloseCombatWith: null,
          closeCombatPosition: null
        };
      }
      return c;
    });
    
    const updated: MatchState = {
      ...match,
      combatants: updatedCombatants,
      log: [...match.log, `${attackerCharacter.name} releases ${targetCharacter.name}.`],
    };
    state.matches.set(lobby.id, updated);
    await upsertMatch(lobby.id, updated);
    sendToLobby(lobby, { type: "match_state", state: updated });
  }
};

const handleBreakFree = async (
  socket: WebSocket,
  lobby: Lobby,
  match: MatchState,
  player: Player,
  actorCombatant: ReturnType<typeof getCombatantByPlayerId>
): Promise<void> => {
  if (!actorCombatant) return;
  
  if (!actorCombatant.grapple?.grappledBy) {
    sendMessage(socket, { type: "error", message: "Not being grappled." });
    return;
  }
  
  const grappledById = actorCombatant.grapple.grappledBy;
  const cpPenalty = actorCombatant.grapple.cpReceived ?? 0;
  
  const attackerCharacter = getCharacterById(match, actorCombatant.characterId);
  const grapplerCombatant = match.combatants.find(c => c.playerId === grappledById);
  const grapplerCharacter = grapplerCombatant ? getCharacterById(match, grapplerCombatant.characterId) : null;
  
  if (!attackerCharacter) {
    sendMessage(socket, { type: "error", message: "Character not found." });
    return;
  }
  
  const wrestlingSkill = attackerCharacter.skills.find(s => s.name === 'Wrestling')?.level ?? attackerCharacter.attributes.strength;
  const breakResult = resolveBreakFree(
    attackerCharacter.attributes.strength,
    wrestlingSkill,
    cpPenalty
  );
  
  if (breakResult.success) {
    const updatedCombatants = match.combatants.map(c => {
      if (c.playerId === player.id || c.playerId === grappledById) {
        return { 
          ...c, 
          grapple: { grappledBy: null, grappling: null, cpSpent: 0, cpReceived: 0 },
          inCloseCombatWith: null,
          closeCombatPosition: null
        };
      }
      return c;
    });
    
    const logEntry = `${attackerCharacter.name} breaks free from ${grapplerCharacter?.name ?? 'grapple'}! ${formatRoll(breakResult.roll, `ST/Skill-${cpPenalty}CP`)}`;
    
    const updated = advanceTurn({
      ...match,
      combatants: updatedCombatants,
      log: [...match.log, logEntry],
    });
    state.matches.set(lobby.id, updated);
    await upsertMatch(lobby.id, updated);
    sendToLobby(lobby, { type: "match_state", state: updated });
    scheduleBotTurn(lobby, updated);
  } else {
    const logEntry = `${attackerCharacter.name} fails to break free. ${formatRoll(breakResult.roll, `ST/Skill-${cpPenalty}CP`)}`;
    
    const updated = advanceTurn({
      ...match,
      log: [...match.log, logEntry],
    });
    state.matches.set(lobby.id, updated);
    await upsertMatch(lobby.id, updated);
    sendToLobby(lobby, { type: "match_state", state: updated });
    scheduleBotTurn(lobby, updated);
  }
};

const handleMoveStep = async (
  socket: WebSocket,
  lobby: Lobby,
  match: MatchState,
  player: Player,
  actorCombatant: ReturnType<typeof getCombatantByPlayerId>,
  payload: CombatActionPayload & { type: "move_step" }
): Promise<void> => {
  if (!actorCombatant) return;
  
  if (actorCombatant.inCloseCombatWith) {
    sendMessage(socket, { type: "error", message: "Cannot move while in close combat." });
    return;
  }
  
  if (!match.turnMovement || match.turnMovement.phase !== 'moving') {
    sendMessage(socket, { type: "error", message: "Movement phase not active." });
    return;
  }
  
  const occupiedHexes: HexCoord[] = match.combatants
    .filter(c => c.playerId !== player.id)
    .map(c => gridToHex(c.position));
  
  const movementState: MovementState = {
    position: match.turnMovement.currentPosition,
    facing: match.turnMovement.currentFacing,
    movePointsRemaining: match.turnMovement.movePointsRemaining,
    freeRotationUsed: match.turnMovement.freeRotationUsed,
    movedBackward: match.turnMovement.movedBackward,
  };
  
  const newState = executeMove(movementState, payload.to, occupiedHexes);
  
  if (!newState) {
    sendMessage(socket, { type: "error", message: "Troppo lontano." });
    return;
  }
  
  const newTurnMovement: TurnMovementState = {
    ...match.turnMovement,
    currentPosition: newState.position,
    currentFacing: newState.facing,
    movePointsRemaining: newState.movePointsRemaining,
    freeRotationUsed: newState.freeRotationUsed,
    movedBackward: newState.movedBackward,
    phase: newState.movePointsRemaining > 0 ? 'moving' : 'completed',
  };
  
  const newReachableHexes = newTurnMovement.phase === 'moving'
    ? calculateReachableHexesInfo(newTurnMovement, occupiedHexes)
    : [];
  
  const updatedCombatants = match.combatants.map((c) =>
    c.playerId === player.id
      ? { ...c, position: hexToGrid(newState.position), facing: newState.facing }
      : c
  );
  
  const updated: MatchState = {
    ...match,
    combatants: updatedCombatants,
    turnMovement: newTurnMovement,
    reachableHexes: newReachableHexes,
  };
  
  state.matches.set(lobby.id, updated);
  await upsertMatch(lobby.id, updated);
  sendToLobby(lobby, { type: "match_state", state: updated });
};

const handleRotate = async (
  socket: WebSocket,
  lobby: Lobby,
  match: MatchState,
  player: Player,
  actorCombatant: ReturnType<typeof getCombatantByPlayerId>,
  payload: CombatActionPayload & { type: "rotate" }
): Promise<void> => {
  if (!actorCombatant) return;
  
  if (actorCombatant.inCloseCombatWith) {
    sendMessage(socket, { type: "error", message: "Cannot rotate while in close combat." });
    return;
  }
  
  if (!match.turnMovement || match.turnMovement.phase !== 'moving') {
    sendMessage(socket, { type: "error", message: "Movement phase not active." });
    return;
  }
  
  const movementState: MovementState = {
    position: match.turnMovement.currentPosition,
    facing: match.turnMovement.currentFacing,
    movePointsRemaining: match.turnMovement.movePointsRemaining,
    freeRotationUsed: match.turnMovement.freeRotationUsed,
    movedBackward: match.turnMovement.movedBackward,
  };
  
  const newState = executeRotation(movementState, payload.facing);
  
  if (!newState) {
    sendMessage(socket, { type: "error", message: "Not enough move points to rotate." });
    return;
  }
  
  const occupiedHexes: HexCoord[] = match.combatants
    .filter(c => c.playerId !== player.id)
    .map(c => gridToHex(c.position));
  
  const newTurnMovement: TurnMovementState = {
    ...match.turnMovement,
    currentFacing: newState.facing,
    movePointsRemaining: newState.movePointsRemaining,
    freeRotationUsed: newState.freeRotationUsed,
    phase: newState.movePointsRemaining > 0 ? 'moving' : 'completed',
  };
  
  const newReachableHexes = newTurnMovement.phase === 'moving'
    ? calculateReachableHexesInfo(newTurnMovement, occupiedHexes)
    : [];
  
  const updatedCombatants = match.combatants.map((c) =>
    c.playerId === player.id ? { ...c, facing: newState.facing } : c
  );
  
  const updated: MatchState = {
    ...match,
    combatants: updatedCombatants,
    turnMovement: newTurnMovement,
    reachableHexes: newReachableHexes,
  };
  
  state.matches.set(lobby.id, updated);
  await upsertMatch(lobby.id, updated);
  sendToLobby(lobby, { type: "match_state", state: updated });
};

const handleUndoMovement = async (
  socket: WebSocket,
  lobby: Lobby,
  match: MatchState,
  player: Player,
  actorCombatant: ReturnType<typeof getCombatantByPlayerId>
): Promise<void> => {
  if (!actorCombatant) return;
  
  if (!match.turnMovement) {
    sendMessage(socket, { type: "error", message: "No movement to undo." });
    return;
  }
  
  const actorCharacter = getCharacterById(match, actorCombatant.characterId);
  const basicMove = actorCharacter?.derived.basicMove ?? 5;
  
  const resetTurnMovement = initializeTurnMovement(
    match.turnMovement.startPosition,
    match.turnMovement.startFacing,
    actorCombatant.maneuver,
    basicMove,
    actorCombatant.posture
  );
  
  const occupiedHexes: HexCoord[] = match.combatants
    .filter(c => c.playerId !== player.id)
    .map(c => gridToHex(c.position));
  
  const newReachableHexes = resetTurnMovement.phase === 'moving'
    ? calculateReachableHexesInfo(resetTurnMovement, occupiedHexes)
    : [];
  
  const updatedCombatants = match.combatants.map((c) =>
    c.playerId === player.id
      ? { 
          ...c, 
          position: hexToGrid(match.turnMovement!.startPosition),
          facing: match.turnMovement!.startFacing 
        }
      : c
  );
  
  const updated: MatchState = {
    ...match,
    combatants: updatedCombatants,
    turnMovement: resetTurnMovement,
    reachableHexes: newReachableHexes,
    log: [...match.log, `${player.name} resets movement.`],
  };
  
  state.matches.set(lobby.id, updated);
  await upsertMatch(lobby.id, updated);
  sendToLobby(lobby, { type: "match_state", state: updated });
};

const handleConfirmMovement = async (
  socket: WebSocket,
  lobby: Lobby,
  match: MatchState,
  player: Player,
  actorCombatant: ReturnType<typeof getCombatantByPlayerId>
): Promise<void> => {
  if (!actorCombatant) return;
  
  if (!match.turnMovement) {
    sendMessage(socket, { type: "error", message: "No movement to confirm." });
    return;
  }
  
  const startPos = match.turnMovement.startPosition;
  const endPos = match.turnMovement.currentPosition;
  const moved = startPos.q !== endPos.q || startPos.r !== endPos.r;
  
  const logMsg = moved
    ? `${player.name} moves to (${endPos.q}, ${endPos.r}).`
    : `${player.name} stays in place.`;
  
  const updatedCombatants = match.combatants.map((c) =>
    c.playerId === player.id
      ? { ...c, statusEffects: [...c.statusEffects, 'has_stepped'] }
      : c
  );
  
  const maneuver = actorCombatant.maneuver;
  const allowsActionAfterMove = maneuver === 'attack' || maneuver === 'aim' || maneuver === 'move_and_attack';
  
  if (allowsActionAfterMove) {
    const updated: MatchState = {
      ...match,
      combatants: updatedCombatants,
      turnMovement: { ...match.turnMovement, phase: 'completed' },
      reachableHexes: [],
      log: [...match.log, logMsg],
    };
    state.matches.set(lobby.id, updated);
    await upsertMatch(lobby.id, updated);
    sendToLobby(lobby, { type: "match_state", state: updated });
  } else {
    const updated = advanceTurn({
      ...match,
      combatants: updatedCombatants,
      turnMovement: undefined,
      reachableHexes: undefined,
      log: [...match.log, logMsg],
    });
    state.matches.set(lobby.id, updated);
    await upsertMatch(lobby.id, updated);
    sendToLobby(lobby, { type: "match_state", state: updated });
    scheduleBotTurn(lobby, updated);
  }
};

const handleSkipMovement = async (
  socket: WebSocket,
  lobby: Lobby,
  match: MatchState,
  player: Player,
  actorCombatant: ReturnType<typeof getCombatantByPlayerId>
): Promise<void> => {
  if (!actorCombatant) return;
  
  if (match.turnMovement) {
    const updatedCombatants = match.combatants.map((c) =>
      c.playerId === player.id
        ? { 
            ...c, 
            position: hexToGrid(match.turnMovement!.startPosition),
            facing: match.turnMovement!.startFacing 
          }
        : c
    );
    
    const maneuver = actorCombatant.maneuver;
    const allowsActionAfterMove = maneuver === 'attack' || maneuver === 'aim' || maneuver === 'move_and_attack';
    
    if (allowsActionAfterMove) {
      const updated: MatchState = {
        ...match,
        combatants: updatedCombatants,
        turnMovement: { ...match.turnMovement, phase: 'completed' },
        reachableHexes: [],
        log: [...match.log, `${player.name} skips movement.`],
      };
      state.matches.set(lobby.id, updated);
      await upsertMatch(lobby.id, updated);
      sendToLobby(lobby, { type: "match_state", state: updated });
    } else {
      const updated = advanceTurn({
        ...match,
        combatants: updatedCombatants,
        turnMovement: undefined,
        reachableHexes: undefined,
        log: [...match.log, `${player.name} skips movement.`],
      });
      state.matches.set(lobby.id, updated);
      await upsertMatch(lobby.id, updated);
      sendToLobby(lobby, { type: "match_state", state: updated });
      scheduleBotTurn(lobby, updated);
    }
  } else {
    const maneuver = actorCombatant.maneuver;
    const allowsActionAfterMove = maneuver === 'attack' || maneuver === 'aim' || maneuver === 'move_and_attack';
    
    if (allowsActionAfterMove) {
      sendMessage(socket, { type: "error", message: "No movement phase to skip." });
    } else {
      const updated = advanceTurn({
        ...match,
        log: [...match.log, `${player.name} skips movement.`],
      });
      state.matches.set(lobby.id, updated);
      await upsertMatch(lobby.id, updated);
      sendToLobby(lobby, { type: "match_state", state: updated });
      scheduleBotTurn(lobby, updated);
    }
  }
};
