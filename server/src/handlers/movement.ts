import type { WebSocket } from "ws";
import type {
  MatchState,
  Player,
  HexCoord,
  TurnMovementState,
  CombatActionPayload,
} from "../../../shared/types";
import { 
  advanceTurn,
  initializeTurnMovement,
  calculateReachableHexesInfo,
  gridToHex,
  hexToGrid,
  executeMove,
  executeRotation,
} from "../../../shared/rules";
import type { MovementState } from "../../../shared/rules";
import type { Lobby } from "../types";
import { state } from "../state";
import { upsertMatch } from "../db";
import { sendMessage, sendToLobby, getCombatantByPlayerId, getCharacterById } from "../helpers";
import { scheduleBotTurn } from "../bot";

export const handleMoveStep = async (
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

export const handleRotate = async (
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

export const handleUndoMovement = async (
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

export const handleConfirmMovement = async (
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

export const handleSkipMovement = async (
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
