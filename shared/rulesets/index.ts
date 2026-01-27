import type { Ruleset, RulesetUIAdapter } from './Ruleset';
import { gurpsBundle } from './gurps';
import { pf2Bundle } from './pf2';
import type { GurpsCombatantState, GurpsCombatActionPayload, PendingDefense } from './gurps/types';
import type { PF2CombatantState, PF2CombatActionPayload, PF2PendingDefense } from './pf2/types';
import type { BaseCombatantState } from './base/types';

export type RulesetBundle = {
  ruleset: Ruleset;
  ui: RulesetUIAdapter;
};

export const rulesets: Record<string, RulesetBundle> = {
  gurps: gurpsBundle,
  pf2: pf2Bundle,
};

export { getServerAdapter, isGurpsMatch, isPf2Match, getGridType } from './serverAdapter';
export type { ServerRulesetAdapter, MovementState } from './serverAdapter';
export type { BaseCombatantState } from './base/types';
export type { GurpsCombatActionPayload } from './gurps/types';
export type { PF2CombatActionPayload } from './pf2/types';

export type CombatActionPayload = GurpsCombatActionPayload | PF2CombatActionPayload;

/**
 * Discriminated union of pending defense states across rulesets.
 * GURPS uses PendingDefense for attack resolution with defense choices.
 * PF2 uses PF2PendingDefense for degree of success tracking.
 */
export type PendingDefenseState = PendingDefense | PF2PendingDefense;

/**
 * Discriminated union of all combatant states across rulesets.
 * Use type guards (isGurpsCombatant, isPF2Combatant) to safely access ruleset-specific fields.
 */
export type CombatantState = GurpsCombatantState | PF2CombatantState;

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

/**
 * Type guard to discriminate GURPS pending defense from other rulesets.
 * Uses the 'deceptivePenalty' field which is GURPS-specific.
 */
export function isGurpsPendingDefense(defense: PendingDefenseState): defense is PendingDefense {
  return 'deceptivePenalty' in defense;
}
