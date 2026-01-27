/**
 * Type guards for discriminating combatant states by ruleset.
 * 
 * IMPORTANT: This file is intentionally kept minimal with NO imports from
 * index.ts or serverAdapter.ts to avoid circular dependency issues.
 * 
 * Import chain that caused issues:
 *   serverAdapter.ts → gurps/rules.ts → index.ts → serverAdapter.ts
 * 
 * By moving type guards here, we break the cycle:
 *   serverAdapter.ts → gurps/rules.ts → guards.ts (no cycle)
 */

import type { BaseCombatantState } from './base/types';
import type { GurpsCombatantState, PendingDefense } from './gurps/types';
import type { PF2CombatantState, PF2PendingDefense } from './pf2/types';

/**
 * Type guard to discriminate GURPS combatants from other rulesets.
 * Uses the 'maneuver' field which is GURPS-specific.
 */
export function isGurpsCombatant(combatant: BaseCombatantState): combatant is GurpsCombatantState {
  return 'maneuver' in combatant;
}

/**
 * Type guard to discriminate PF2 combatants from other rulesets.
 * Uses the 'actionsRemaining' field which is PF2-specific.
 */
export function isPF2Combatant(combatant: BaseCombatantState): combatant is PF2CombatantState {
  return 'actionsRemaining' in combatant;
}

// Union type for pending defense states
export type PendingDefenseState = PendingDefense | PF2PendingDefense;

/**
 * Type guard to discriminate GURPS pending defense from other rulesets.
 * Uses the 'deceptivePenalty' field which is GURPS-specific.
 */
export function isGurpsPendingDefense(defense: PendingDefenseState): defense is PendingDefense {
  return 'deceptivePenalty' in defense;
}
