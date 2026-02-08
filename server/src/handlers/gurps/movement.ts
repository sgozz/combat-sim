import type { WebSocket } from "ws";
import type {
  MatchState,
  Player,
  HexCoord,
  TurnMovementState,
} from "../../../../shared/types";
import type { GurpsCharacterSheet } from "../../../../shared/rulesets/gurps/characterSheet";
import type { CombatActionPayload } from "../../../../shared/rulesets";
import { isGurpsCombatant } from "../../../../shared/rulesets";
import { advanceTurn } from "../../rulesetHelpers";
import { getServerAdapter } from "../../../../shared/rulesets/serverAdapter";
import { assertRulesetId } from "../../../../shared/rulesets/defaults";
import type { MovementState } from "../../../../shared/rulesets/serverAdapter";
import { state } from "../../state";
import { updateMatchState } from "../../db";
import { sendMessage, sendToMatch, getCombatantByPlayerId, getCharacterById } from "../../helpers";
import { scheduleBotTurn } from "../../bot";
import { checkWaitTriggers } from "../../../../shared/rulesets/gurps/rules";
import { executeWaitInterrupt } from "./wait-interrupt";
import type { GurpsCombatantState } from "../../../../shared/rulesets/gurps/types";

const asGurpsCharacter = (match: MatchState, characterId: string): GurpsCharacterSheet | undefined => {
  return getCharacterById(match, characterId) as GurpsCharacterSheet | undefined;
};

export const handleMoveStep = async (
  socket: WebSocket,
  matchId: string,
  match: MatchState,
  player: Player,
  actorCombatant: ReturnType<typeof getCombatantByPlayerId>,
  payload: CombatActionPayload & { type: "move_step" }
): Promise<void> => {
  if (!actorCombatant) return;
  if (!isGurpsCombatant(actorCombatant)) return;
  
  if (actorCombatant.inCloseCombatWith) {
    sendMessage(socket, { type: "error", message: "Cannot move while in close combat." });
    return;
  }
  
   if (!match.turnMovement || match.turnMovement.phase !== 'moving') {
     sendMessage(socket, { type: "error", message: "Movement phase not active." });
     return;
   }
   
    const adapter = getServerAdapter(assertRulesetId(match.rulesetId));
    const occupiedHexes: HexCoord[] = match.combatants
      .filter(c => c.playerId !== player.id)
      .map(c => adapter.gridToHex(c.position));
   
    const movementState: MovementState = {
      position: match.turnMovement.currentPosition,
      facing: match.turnMovement.currentFacing,
      movePointsRemaining: match.turnMovement.movePointsRemaining,
      freeRotationUsed: match.turnMovement.freeRotationUsed,
      movedBackward: match.turnMovement.movedBackward,
    };
    
    if (!adapter.executeMove) {
      sendMessage(socket, { type: "error", message: "Movement not supported for this ruleset." });
      return;
    }
    const newState = adapter.executeMove(movementState, payload.to, occupiedHexes, match.mapDefinition);
  
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
    ? adapter.calculateReachableHexesInfo(newTurnMovement, occupiedHexes, match.mapDefinition)
    : [];
  
  const movementPath = newState.path
    ? newState.path.map(p => adapter.hexToGrid(p))
    : undefined;
  
  const updatedCombatants = match.combatants.map((c) =>
    c.playerId === player.id
      ? { ...c, position: adapter.hexToGrid(newState.position), facing: newState.facing, movementPath }
      : c
  );
  
  let updated: MatchState = {
    ...match,
    combatants: updatedCombatants,
    turnMovement: newTurnMovement,
    reachableHexes: newReachableHexes,
  };
  
  // Check for wait triggers after movement
  const gurbsCombatants = updated.combatants.filter(isGurpsCombatant) as GurpsCombatantState[];
  const triggerCheck = checkWaitTriggers(gurbsCombatants, {
    type: 'enemy_moves_adjacent',
    actorId: player.id,
    actorPosition: newState.position,
  });
  
  if (triggerCheck) {
    updated = executeWaitInterrupt(updated, triggerCheck.combatantId, player.id);
  }
  
  state.matches.set(matchId, updated);
  await updateMatchState(matchId, updated);
  sendToMatch(matchId, { type: "match_state", state: updated });
};

export const handleRotate = async (
  socket: WebSocket,
  matchId: string,
  match: MatchState,
  player: Player,
  actorCombatant: ReturnType<typeof getCombatantByPlayerId>,
  payload: CombatActionPayload & { type: "rotate" }
): Promise<void> => {
  if (!actorCombatant) return;
  if (!isGurpsCombatant(actorCombatant)) return;
  
  if (actorCombatant.inCloseCombatWith) {
    sendMessage(socket, { type: "error", message: "Cannot rotate while in close combat." });
    return;
  }
  
   if (!match.turnMovement || match.turnMovement.phase !== 'moving') {
     sendMessage(socket, { type: "error", message: "Movement phase not active." });
     return;
   }
   
    const adapter = getServerAdapter(assertRulesetId(match.rulesetId));
    
     const movementState: MovementState = {
       position: match.turnMovement.currentPosition,
       facing: match.turnMovement.currentFacing,
       movePointsRemaining: match.turnMovement.movePointsRemaining,
      freeRotationUsed: match.turnMovement.freeRotationUsed,
      movedBackward: match.turnMovement.movedBackward,
    };
    
    if (!adapter.executeRotation) {
      sendMessage(socket, { type: "error", message: "Rotation not supported for this ruleset." });
      return;
    }
    const newState = adapter.executeRotation(movementState, payload.facing);
   
   if (!newState) {
     sendMessage(socket, { type: "error", message: "Not enough move points to rotate." });
     return;
   }
  const occupiedHexes: HexCoord[] = match.combatants
    .filter(c => c.playerId !== player.id)
    .map(c => adapter.gridToHex(c.position));
  
  const newTurnMovement: TurnMovementState = {
    ...match.turnMovement,
    currentFacing: newState.facing,
    movePointsRemaining: newState.movePointsRemaining,
    freeRotationUsed: newState.freeRotationUsed,
    phase: newState.movePointsRemaining > 0 ? 'moving' : 'completed',
  };
  
  const newReachableHexes = newTurnMovement.phase === 'moving'
    ? adapter.calculateReachableHexesInfo(newTurnMovement, occupiedHexes, match.mapDefinition)
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
  
  state.matches.set(matchId, updated);
  await updateMatchState(matchId, updated);
  sendToMatch(matchId, { type: "match_state", state: updated });
};

export const handleUndoMovement = async (
  socket: WebSocket,
  matchId: string,
  match: MatchState,
  player: Player,
  actorCombatant: ReturnType<typeof getCombatantByPlayerId>
): Promise<void> => {
  if (!actorCombatant) return;
  if (!isGurpsCombatant(actorCombatant)) return;
  
  if (!match.turnMovement) {
    sendMessage(socket, { type: "error", message: "No movement to undo." });
    return;
  }
  
   const actorCharacter = asGurpsCharacter(match, actorCombatant.characterId);
   const basicMove = actorCharacter?.derived.basicMove ?? 5;
   
   const adapter = getServerAdapter(assertRulesetId(match.rulesetId));
  const resetTurnMovement = adapter.initializeTurnMovement(
    match.turnMovement.startPosition,
    match.turnMovement.startFacing,
    actorCombatant.maneuver,
    basicMove,
    actorCombatant.posture
  );
  
  const occupiedHexes: HexCoord[] = match.combatants
    .filter(c => c.playerId !== player.id)
    .map(c => adapter.gridToHex(c.position));
  
  const newReachableHexes = resetTurnMovement.phase === 'moving'
    ? adapter.calculateReachableHexesInfo(resetTurnMovement, occupiedHexes, match.mapDefinition)
    : [];
  
  const updatedCombatants = match.combatants.map((c) =>
    c.playerId === player.id
      ? { 
          ...c, 
          position: adapter.hexToGrid(match.turnMovement!.startPosition),
          facing: match.turnMovement!.startFacing,
          movementPath: undefined,
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
  
  state.matches.set(matchId, updated);
  await updateMatchState(matchId, updated);
  sendToMatch(matchId, { type: "match_state", state: updated });
};

export const handleConfirmMovement = async (
  socket: WebSocket,
  matchId: string,
  match: MatchState,
  player: Player,
  actorCombatant: ReturnType<typeof getCombatantByPlayerId>
): Promise<void> => {
  if (!actorCombatant) return;
  if (!isGurpsCombatant(actorCombatant)) return;
  
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
       ? { ...c, statusEffects: [...c.statusEffects, 'has_stepped'], movementPath: undefined }
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
    state.matches.set(matchId, updated);
    await updateMatchState(matchId, updated);
    sendToMatch(matchId, { type: "match_state", state: updated });
  } else {
    const updated = advanceTurn({
      ...match,
      combatants: updatedCombatants,
      turnMovement: undefined,
      reachableHexes: undefined,
      log: [...match.log, logMsg],
    });
    state.matches.set(matchId, updated);
    await updateMatchState(matchId, updated);
    sendToMatch(matchId, { type: "match_state", state: updated });
    scheduleBotTurn(matchId, updated);
  }
};

export const handleSkipMovement = async (
  socket: WebSocket,
  matchId: string,
  match: MatchState,
  player: Player,
  actorCombatant: ReturnType<typeof getCombatantByPlayerId>
): Promise<void> => {
  if (!actorCombatant) return;
  if (!isGurpsCombatant(actorCombatant)) return;
  
  if (match.turnMovement) {
    const adapter = getServerAdapter(assertRulesetId(match.rulesetId));
    const updatedCombatants = match.combatants.map((c) =>
      c.playerId === player.id
        ? { 
            ...c, 
            position: adapter.hexToGrid(match.turnMovement!.startPosition),
            facing: match.turnMovement!.startFacing,
            movementPath: undefined,
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
      state.matches.set(matchId, updated);
      await updateMatchState(matchId, updated);
      sendToMatch(matchId, { type: "match_state", state: updated });
    } else {
      const updated = advanceTurn({
        ...match,
        combatants: updatedCombatants,
        turnMovement: undefined,
        reachableHexes: undefined,
        log: [...match.log, `${player.name} skips movement.`],
      });
      state.matches.set(matchId, updated);
      await updateMatchState(matchId, updated);
      sendToMatch(matchId, { type: "match_state", state: updated });
      scheduleBotTurn(matchId, updated);
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
      state.matches.set(matchId, updated);
      await updateMatchState(matchId, updated);
      sendToMatch(matchId, { type: "match_state", state: updated });
      scheduleBotTurn(matchId, updated);
    }
  }
};
