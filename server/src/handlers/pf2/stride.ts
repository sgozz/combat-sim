import type { WebSocket } from "ws";
import type { MatchState, Player, ReachableHexInfo } from "../../../../shared/types";
import type { CombatantState } from "../../../../shared/rulesets";
import { isPF2Combatant } from "../../../../shared/rulesets";
import { getReachableSquares, gridToHex } from "../../../../shared/rulesets/pf2/rules";
import { state } from "../../state";
import { updateMatchState } from "../../db";
import { sendMessage, sendToMatch, getCharacterById } from "../../helpers";
import { isPF2Character } from "../../../../shared/rulesets/characterSheet";
import { getAoOReactors, executeAoOStrike } from "./reaction";
import { isBlocked } from "../../../../shared/map/terrain";

export const handlePF2RequestMove = async (
  socket: WebSocket,
  matchId: string,
  match: MatchState,
  player: Player,
  actorCombatant: CombatantState,
  payload?: { mode?: 'stride' | 'step' }
): Promise<void> => {
  if (!isPF2Combatant(actorCombatant)) return;

  const actionsRemaining = actorCombatant.actionsRemaining;
  if (actionsRemaining < 1) {
    sendMessage(socket, { type: "error", message: "No actions remaining." });
    return;
  }

  const mode = payload?.mode ?? 'stride';
  const character = getCharacterById(match, actorCombatant.characterId);
  const speed = (character && isPF2Character(character)) ? character.derived.speed : 25;

  const startPos = gridToHex(actorCombatant.position);

  const occupiedSquares = match.combatants
    .filter(c => c.playerId !== player.id)
    .map(c => gridToHex(c.position));

  let reachable: Map<string, { position: { q: number; r: number }; cost: number; path?: { q: number; r: number }[] }>;
  
  if (mode === 'step') {
    const adjacent = [
      { q: startPos.q + 1, r: startPos.r },
      { q: startPos.q - 1, r: startPos.r },
      { q: startPos.q, r: startPos.r + 1 },
      { q: startPos.q, r: startPos.r - 1 },
      { q: startPos.q + 1, r: startPos.r - 1 },
      { q: startPos.q - 1, r: startPos.r + 1 },
      { q: startPos.q + 1, r: startPos.r + 1 },
      { q: startPos.q - 1, r: startPos.r - 1 },
    ];
    
    reachable = new Map();
    adjacent
      .filter(pos => !occupiedSquares.some(occ => occ.q === pos.q && occ.r === pos.r))
      .filter(pos => !isBlocked(match.mapDefinition, pos.q, pos.r))
      .forEach(pos => {
        const key = `${pos.q},${pos.r}`;
        reachable.set(key, { position: pos, cost: 5, path: [startPos, pos] });
      });
  } else {
    reachable = getReachableSquares(startPos, speed, occupiedSquares, match.mapDefinition);
  }

  const reachableHexes: ReachableHexInfo[] = [];
  reachable.forEach((cell) => {
    reachableHexes.push({
      q: cell.position.q,
      r: cell.position.r,
      cost: cell.cost,
      finalFacing: 0,
      path: cell.path,
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

  const reachable = getReachableSquares(startPos, speed, occupiedSquares, match.mapDefinition);
  const destKey = `${payload.to.q},${payload.to.r}`;
  const destResult = reachable.get(destKey);

  if (!destResult) {
    sendMessage(socket, { type: "error", message: "Destination not reachable." });
    return;
  }
  
  const movementPath = destResult.path
    ? destResult.path.map((p: { q: number; r: number }) => ({ x: p.q, y: 0, z: p.r }))
    : [{ x: startPos.q, y: 0, z: startPos.r }, { x: payload.to.q, y: 0, z: payload.to.r }];

  const reactors = getAoOReactors(match, actorCombatant);

  if (reactors.length > 0) {
    const firstReactor = reactors[0];
    const reactorPlayer = match.players.find(p => p.id === firstReactor.playerId);

    const preMoveCombatants = match.combatants.map(c =>
      c.playerId === player.id && isPF2Combatant(c)
        ? { ...c, actionsRemaining: c.actionsRemaining - 1 }
        : c
    );

    if (reactorPlayer?.isBot) {
      // Bot auto-executes AoO
      let updatedMatch: MatchState = { ...match, combatants: preMoveCombatants };
      const updatedActor = updatedMatch.combatants.find(c => c.playerId === player.id);
      if (!updatedActor) return;

      updatedMatch = executeAoOStrike(updatedMatch, matchId, firstReactor, updatedActor);

      const actorAfterAoO = updatedMatch.combatants.find(c => c.playerId === player.id);
      if (actorAfterAoO && actorAfterAoO.currentHP <= 0) {
        const finalState: MatchState = {
          ...updatedMatch,
          log: [...updatedMatch.log, `${player.name}'s stride is interrupted — they fall unconscious!`],
          reachableHexes: undefined,
        };
        state.matches.set(matchId, finalState);
        await updateMatchState(matchId, finalState);
        await sendToMatch(matchId, { type: "match_state", state: finalState });
        return;
      }

      const movedCombatants = updatedMatch.combatants.map(c =>
        c.playerId === player.id
          ? { ...c, position: { x: payload.to.q, y: c.position.y, z: payload.to.r }, movementPath }
          : c
      );

      const finalState: MatchState = {
        ...updatedMatch,
        combatants: movedCombatants,
        log: [...updatedMatch.log, `${player.name} strides to (${payload.to.q}, ${payload.to.r}).`],
        reachableHexes: undefined,
      };

      state.matches.set(matchId, finalState);
      await updateMatchState(matchId, finalState);
      await sendToMatch(matchId, { type: "match_state", state: finalState });
      return;
    }

    // Player reactor: pause and send prompt
    const pausedState: MatchState = {
      ...match,
      combatants: preMoveCombatants,
      pendingReaction: {
        reactorId: firstReactor.playerId,
        triggerId: player.id,
        triggerAction: 'stride',
        originalPayload: { type: 'pf2_stride', to: payload.to },
      },
      reachableHexes: undefined,
    };

    state.matches.set(matchId, pausedState);
    await updateMatchState(matchId, pausedState);
    await sendToMatch(matchId, { type: "match_state", state: pausedState });
    await sendToMatch(matchId, {
      type: "reaction_prompt",
      matchId,
      reactorId: firstReactor.playerId,
      triggerAction: 'stride',
    });
    return;
  }

  const updatedCombatants = match.combatants.map((c) =>
    c.playerId === player.id
      ? {
          ...c,
          ...(isPF2Combatant(c) ? { actionsRemaining: c.actionsRemaining - 1 } : {}),
          position: { x: payload.to.q, y: c.position.y, z: payload.to.r },
          movementPath,
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
