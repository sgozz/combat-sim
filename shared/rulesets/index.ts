import type { Ruleset, RulesetUIAdapter } from './Ruleset';
import { gurpsBundle } from './gurps';
import { pf2Bundle } from './pf2';
import type { GurpsCombatantState, GurpsCombatActionPayload } from './gurps/types';
import type { PF2CombatantState, PF2CombatActionPayload } from './pf2/types';

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

export type CombatantState = GurpsCombatantState | PF2CombatantState;

export { isGurpsCombatant, isPF2Combatant, isGurpsPendingDefense } from './guards';
export type { PendingDefenseState } from './guards';
