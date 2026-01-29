import type { WebSocket } from "ws";
import type { MatchState, Player, ReachableHexInfo } from "../../../../shared/types";
import type { CombatantState } from "../../../../shared/rulesets";
import { isPF2Combatant } from "../../../../shared/rulesets";
import { getServerAdapter } from "../../../../shared/rulesets/serverAdapter";
import { assertRulesetId } from "../../../../shared/rulesets/defaults";
import { getReachableSquares, gridToHex } from "../../../../shared/rulesets/pf2/rules";
import { state } from "../../state";
import { updateMatchState } from "../../db";
import { sendMessage, sendToMatch, getCharacterById } from "../../helpers";
import { isPF2Character } from "../../../../shared/rulesets/characterSheet";

export const handlePF2RequestMove = async (
  socket: WebSocket,
  matchId: string,
  match: MatchState,
  player: Player,
  actorCombatant: CombatantState,
  payload: { mode: 'stride' }
): Promise<void> => {
  if (!isPF2Combatant(actorCombatant)) return;

  const actionsRemaining = actorCombatant.actionsRemaining;
  if (actionsRemaining < 1) {
    sendMessage(socket, { type: "error", message: "No actions remaining." });
    return;
  }

  const character = getCharacterById(match, actorCombatant.characterId);
  const speed = (character && isPF2Character(character)) ? character.derived.speed : 25;

  const startPos = gridToHex(actorCombatant.position);

  const occupiedSquares = match.combatants
    .filter(c => c.playerId !== player.id)
    .map(c => gridToHex(c.position));

  const reachable = getReachableSquares(startPos, speed, occupiedSquares);

  const reachableHexes: ReachableHexInfo[] = [];
  reachable.forEach((cell) => {
    reachableHexes.push({
      q: cell.position.q,
      r: cell.position.r,
      cost: cell.cost,
      finalFacing: 0,
    });
  });

  const updated: MatchState = {
    ...match,
    reachableHexes,
  };

  state.matches.set(matchId, updated);
  await updateMatchState(matchId, updated);
  await sendToMatch(matchId, { type: "match_state", state: updated });
};

export const handlePF2Stride = async (
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

  const character = getCharacterById(match, actorCombatant.characterId);
  const speed = (character && isPF2Character(character)) ? character.derived.speed : 25;

  const startPos = gridToHex(actorCombatant.position);
  const occupiedSquares = match.combatants
    .filter(c => c.playerId !== player.id)
    .map(c => gridToHex(c.position));

  const reachable = getReachableSquares(startPos, speed, occupiedSquares);
  const destKey = `${payload.to.q},${payload.to.r}`;

  if (!reachable.has(destKey)) {
    sendMessage(socket, { type: "error", message: "Destination not reachable." });
    return;
  }

  const updatedCombatants = match.combatants.map((c) =>
    c.playerId === player.id
      ? {
          ...c,
          ...(isPF2Combatant(c) ? { actionsRemaining: c.actionsRemaining - 1 } : {}),
          position: { x: payload.to.q, y: c.position.y, z: payload.to.r },
        }
      : c
  );

  const updated: MatchState = {
    ...match,
    combatants: updatedCombatants,
    log: [...match.log, `${player.name} strides to (${payload.to.q}, ${payload.to.r}).`],
    reachableHexes: undefined,
  };

  state.matches.set(matchId, updated);
  await updateMatchState(matchId, updated);
  await sendToMatch(matchId, { type: "match_state", state: updated });
};
