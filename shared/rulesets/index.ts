import type { Ruleset, RulesetUIAdapter } from './Ruleset';
import { gurpsBundle } from './gurps';
import { pf2Bundle } from './pf2';
import type { GurpsCombatantState } from './gurps/types';
import type { PF2CombatantState } from './pf2/types';
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
