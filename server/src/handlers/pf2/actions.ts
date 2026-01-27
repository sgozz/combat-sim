import type { WebSocket } from "ws";
import type { MatchState, Player } from "../../../../shared/types";
import type { CombatantState } from "../../../../shared/rulesets";
import { isPF2Combatant } from "../../../../shared/rulesets";
import type { Posture } from "../../../../shared/rulesets/gurps/types";
import { state } from "../../state";
import { updateMatchState } from "../../db";
import { sendMessage, sendToMatch } from "../../helpers";

type CombatantUpdate = {
  posture?: Posture;
  position?: { x: number; y: number; z: number };
};

const updateCombatantActions = (
  combatant: CombatantState,
  actionsUsed: number,
  additionalUpdates: CombatantUpdate = {}
): CombatantState => {
  if (!isPF2Combatant(combatant)) return combatant;
  
  const currentActions = combatant.actionsRemaining;
  const newActionsRemaining = currentActions - actionsUsed;
  
  return {
    ...combatant,
    ...additionalUpdates,
    actionsRemaining: newActionsRemaining,
  };
};

export const handlePF2DropProne = async (
  socket: WebSocket,
  matchId: string,
  match: MatchState,
  player: Player,
  actorCombatant: CombatantState
): Promise<void> => {
  if (!isPF2Combatant(actorCombatant)) return;

  const actionsRemaining = actorCombatant.actionsRemaining;
  if (actionsRemaining < 1) {
    sendMessage(socket, { type: "error", message: "No actions remaining." });
    return;
  }

  const updatedCombatants = match.combatants.map((c) =>
    c.playerId === player.id
      ? updateCombatantActions(c, 1)
      : c
  );

  const updated: MatchState = {
    ...match,
    combatants: updatedCombatants,
    log: [...match.log, `${player.name} drops prone.`],
    turnMovement: undefined,
    reachableHexes: undefined,
  };
  
  state.matches.set(matchId, updated);
  await updateMatchState(matchId, updated);
  await sendToMatch(matchId, { type: "match_state", state: updated });
};

export const handlePF2Stand = async (
  socket: WebSocket,
  matchId: string,
  match: MatchState,
  player: Player,
  actorCombatant: CombatantState
): Promise<void> => {
  if (!isPF2Combatant(actorCombatant)) return;
  
  sendMessage(socket, { type: "error", message: "Stand action not available in PF2." });
};

export const handlePF2Step = async (
  socket: WebSocket,
  matchId: string,
  match: MatchState,
  player: Player,
  actorCombatant: CombatantState,
  payload: { to: { q: number; r: number } }
): Promise<void> => {
  if (!isPF2Combatant(actorCombatant)) return;

  const actionsRemaining = actorCombatant.actionsRemaining;
  if (actionsRemaining < 1) {
    sendMessage(socket, { type: "error", message: "No actions remaining." });
    return;
  }

  const dx = Math.abs(payload.to.q - actorCombatant.position.x);
  const dz = Math.abs(payload.to.r - actorCombatant.position.z);
  const chebyshevDistance = Math.max(dx, dz);

  if (chebyshevDistance !== 1) {
    sendMessage(socket, { type: "error", message: "Step can only move 1 square." });
    return;
  }

  const occupant = match.combatants.find(c =>
    c.playerId !== player.id &&
    c.position.x === payload.to.q &&
    c.position.z === payload.to.r
  );
  if (occupant) {
    sendMessage(socket, { type: "error", message: "Hex is occupied." });
    return;
  }

  const updatedCombatants = match.combatants.map((c) =>
    c.playerId === player.id
      ? updateCombatantActions(c, 1, { 
          position: { x: payload.to.q, y: c.position.y, z: payload.to.r } 
        })
      : c
  );

  const updated: MatchState = {
    ...match,
    combatants: updatedCombatants,
    log: [...match.log, `${player.name} steps to (${payload.to.q}, ${payload.to.r}).`],
  };
  
  state.matches.set(matchId, updated);
  await updateMatchState(matchId, updated);
  await sendToMatch(matchId, { type: "match_state", state: updated });
};
