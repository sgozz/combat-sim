import type { Ruleset, RulesetUIAdapter } from './Ruleset';
import { gurpsBundle } from './gurps';
import { pf2Bundle } from './pf2';

export type RulesetBundle = {
  ruleset: Ruleset;
  ui: RulesetUIAdapter;
};

export const rulesets: Record<string, RulesetBundle> = {
  gurps: gurpsBundle,
  pf2: pf2Bundle,
};

export { getServerAdapter, isGurpsMatch, isPf2Match } from './serverAdapter';
export type { ServerRulesetAdapter, MovementState } from './serverAdapter';
export type { BaseCombatantState } from './base/types';
