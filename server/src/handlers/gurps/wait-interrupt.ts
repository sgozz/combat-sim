import type { MatchState, Id } from '../../../../shared/types';
import { isGurpsCombatant } from '../../../../shared/rulesets';

/**
 * Execute a wait trigger interrupt action.
 * 
 * This handler implements the "pause-execute-resume" pattern for GURPS wait interrupts:
 * 1. Save current turn state
 * 2. Temporarily set active turn to waiting combatant
 * 3. Execute the wait action (attack/move/ready)
 * 4. Clear the wait trigger
 * 5. Restore original active turn
 * 
 * V1 Implementation: Logs the interrupt action instead of fully executing it.
 * Full action execution can be added incrementally in future iterations.
 * 
 * @param match - Current match state
 * @param waitingCombatantId - ID of the combatant who set the wait trigger
 * @param triggerSourceId - ID of the combatant who triggered the wait condition
 * @returns Updated match state with interrupt logged and trigger cleared
 */
export const executeWaitInterrupt = (
  match: MatchState,
  waitingCombatantId: Id,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _triggerSourceId: Id
): MatchState => {
  // 1. Find waiting combatant and validate state
  const waiter = match.combatants.find(c => c.playerId === waitingCombatantId);
  if (!waiter || !isGurpsCombatant(waiter) || !waiter.waitTrigger) {
    return match; // Invalid state, no-op
  }

  const waiterCharacter = match.characters.find(c => c.id === waiter.characterId);
  const waiterName = waiterCharacter?.name ?? 'Unknown';

  // 2. Save current turn state
  const originalActiveTurnPlayerId = match.activeTurnPlayerId;

  // 3. Temporarily set active turn to waiter
  let updatedMatch: MatchState = {
    ...match,
    activeTurnPlayerId: waitingCombatantId,
  };

  // 4. Execute action based on waitTrigger.action
  const { action } = waiter.waitTrigger;

  switch (action) {
    case 'attack':
      // V1: Auto-target trigger source
      // Future: Use attackPayload if present for specific targeting
      // Future: Integrate with handleAttackAction for full attack resolution
      updatedMatch = {
        ...updatedMatch,
        log: [...updatedMatch.log, `${waiterName} interrupts with an attack!`],
      };
      break;

    case 'move':
      // V1: Just log the interrupt
      // Future: Execute 1-hex step toward/away from trigger source using movePayload
      // Future: Integrate with handleMoveStep for movement validation
      updatedMatch = {
        ...updatedMatch,
        log: [...updatedMatch.log, `${waiterName} interrupts with movement!`],
      };
      break;

    case 'ready':
      // V1: Just log the interrupt
      // Future: Execute ready action using readyPayload
      // Future: Integrate with handleReadyAction for equipment state changes
      updatedMatch = {
        ...updatedMatch,
        log: [...updatedMatch.log, `${waiterName} interrupts to ready!`],
      };
      break;
  }

  // 5. Clear waitTrigger on the combatant
  updatedMatch = {
    ...updatedMatch,
    combatants: updatedMatch.combatants.map(c =>
      c.playerId === waitingCombatantId && isGurpsCombatant(c)
        ? { ...c, waitTrigger: null }
        : c
    ),
  };

  // 6. Restore original active turn
  updatedMatch = {
    ...updatedMatch,
    activeTurnPlayerId: originalActiveTurnPlayerId,
  };

  return updatedMatch;
};
