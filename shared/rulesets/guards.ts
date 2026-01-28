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

import type { GurpsCombatantState, PendingDefense } from './gurps/types';
import type { PF2CombatantState, PF2PendingDefense } from './pf2/types';

/**
 * Type guard to discriminate GURPS combatants from other rulesets.
 * Uses the 'maneuver' field which is GURPS-specific.
 * Accepts unknown for ergonomic usage with external data sources.
 */
export function isGurpsCombatant(combatant: unknown): combatant is GurpsCombatantState {
  return (
    typeof combatant === 'object' &&
    combatant !== null &&
    'maneuver' in combatant
  );
}

/**
 * Type guard to discriminate PF2 combatants from other rulesets.
 * Uses the 'actionsRemaining' field which is PF2-specific.
 * Accepts unknown for ergonomic usage with external data sources.
 */
export function isPF2Combatant(combatant: unknown): combatant is PF2CombatantState {
  return (
    typeof combatant === 'object' &&
    combatant !== null &&
    'actionsRemaining' in combatant
  );
}

// Union type for pending defense states
export type PendingDefenseState = PendingDefense | PF2PendingDefense;

/**
 * Type guard to discriminate GURPS pending defense from other rulesets.
 * Uses the 'deceptivePenalty' field which is GURPS-specific.
 * Accepts unknown for ergonomic usage with external data sources.
 */
export function isGurpsPendingDefense(defense: unknown): defense is PendingDefense {
  return (
    typeof defense === 'object' &&
    defense !== null &&
    'deceptivePenalty' in defense
  );
}
