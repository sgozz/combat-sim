import type { RulesetUIAdapter } from '../../../../shared/rulesets/Ruleset';

export const getRulesetUiAdapter = (): RulesetUIAdapter => ({
  getActionLayout: () => [],
  getActionLabels: () => ({}),
  getActionTooltips: () => ({}),
  getManeuvers: () => [],
  getCloseCombatManeuvers: () => [],
  getAoaVariants: () => [],
  getAodVariants: () => [],
  getManeuverInstructions: () => null,
  getTemplateNames: () => [],
});
