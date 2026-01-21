import type { Ruleset, RulesetUIAdapter } from './Ruleset';
import { gurpsBundle } from './gurps';

export type RulesetBundle = {
  ruleset: Ruleset;
  ui: RulesetUIAdapter;
};

export const rulesets: Record<string, RulesetBundle> = {
  gurps: gurpsBundle,
};
