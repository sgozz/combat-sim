import type { WebSocket } from "ws";
import type { MatchState, Player } from "../../../../shared/types";
import type { CombatantState, Posture } from "../../../../shared/rulesets/gurps/types";
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
  const currentActions = combatant.pf2?.actionsRemaining ?? combatant.attacksRemaining;
  const newActionsRemaining = currentActions - actionsUsed;
  
  return {
    ...combatant,
    ...additionalUpdates,
    attacksRemaining: newActionsRemaining,
    pf2: {
      actionsRemaining: newActionsRemaining,
      reactionAvailable: combatant.pf2?.reactionAvailable ?? true,
      mapPenalty: combatant.pf2?.mapPenalty ?? 0,
      attacksThisTurn: combatant.pf2?.attacksThisTurn ?? 0,
      shieldRaised: combatant.pf2?.shieldRaised ?? false,
    },
  };
};

export const handlePF2DropProne = async (
  socket: WebSocket,
  matchId: string,
  match: MatchState,
  player: Player,
  actorCombatant: CombatantState
): Promise<void> => {
  if (actorCombatant.posture === 'prone') {
    sendMessage(socket, { type: "error", message: "Already prone." });
    return;
  }

  const actionsRemaining = actorCombatant.pf2?.actionsRemaining ?? actorCombatant.attacksRemaining;
  if (actionsRemaining < 1) {
    sendMessage(socket, { type: "error", message: "No actions remaining." });
    return;
  }

  const updatedCombatants = match.combatants.map((c) =>
    c.playerId === player.id
      ? updateCombatantActions(c, 1, { posture: 'prone' as const })
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
  if (actorCombatant.posture !== 'prone') {
    sendMessage(socket, { type: "error", message: "Can only stand when prone." });
    return;
  }

  const actionsRemaining = actorCombatant.pf2?.actionsRemaining ?? actorCombatant.attacksRemaining;
  if (actionsRemaining < 1) {
    sendMessage(socket, { type: "error", message: "No actions remaining." });
    return;
  }

  const updatedCombatants = match.combatants.map((c) =>
    c.playerId === player.id
      ? updateCombatantActions(c, 1, { posture: 'standing' as const })
      : c
  );

  const updated: MatchState = {
    ...match,
    combatants: updatedCombatants,
    log: [...match.log, `${player.name} stands up.`],
    turnMovement: undefined,
    reachableHexes: undefined,
  };
  
  state.matches.set(matchId, updated);
  await updateMatchState(matchId, updated);
  await sendToMatch(matchId, { type: "match_state", state: updated });
};

export const handlePF2Step = async (
  socket: WebSocket,
  matchId: string,
  match: MatchState,
  player: Player,
  actorCombatant: CombatantState,
  payload: { to: { q: number; r: number } }
): Promise<void> => {
  if (actorCombatant.posture === 'prone') {
    sendMessage(socket, { type: "error", message: "Cannot Step while prone. Use Stand first." });
    return;
  }

  const actionsRemaining = actorCombatant.pf2?.actionsRemaining ?? actorCombatant.attacksRemaining;
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
