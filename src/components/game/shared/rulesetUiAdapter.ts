import type { RulesetUIAdapter } from '../../../../shared/rulesets/Ruleset';

export const getRulesetUiAdapter = (): RulesetUIAdapter => ({
  getActionLayout: () => [],
  getActionLabels: () => ({}),
  getActionTooltips: () => ({}),
});
