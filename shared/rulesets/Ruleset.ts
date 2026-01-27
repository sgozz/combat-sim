import type { CharacterSheet, MatchState, RulesetId } from '../types';
import type { GurpsCombatantState, ManeuverType, AOAVariant, AODVariant } from './gurps/types';
import type { PF2CombatantState } from './pf2/types';

export type RulesetAction = {
  type: string;
  label: string;
  description?: string;
  icon?: string;
};

export type RulesetCombatPreview = {
  summary: string;
  details?: string[];
};

export type RulesetManeuver = {
  type: ManeuverType;
  label: string;
  shortLabel: string;
  icon: string;
  desc: string;
  key: string;
};

export type RulesetVariant = {
  variant: AOAVariant | AODVariant;
  label: string;
  desc: string;
};

export type ManeuverInstruction = {
  text: string;
  canAttack: boolean;
  canMove: boolean;
  isStep: boolean;
  canEvaluate?: boolean;
  canReady?: boolean;
};

export type Ruleset = {
  id: RulesetId;
  getDerivedStats: (character: CharacterSheet) => CharacterSheet['derived'];
  getInitialCombatantState: (character: CharacterSheet) => Omit<GurpsCombatantState | PF2CombatantState, 'playerId' | 'characterId' | 'position' | 'facing'>;
  getAvailableActions: (state: MatchState, actorId: string) => RulesetAction[];
  getCombatPreview: (state: MatchState, actorId: string, targetId: string, actionType: string) => RulesetCombatPreview | null;
  createCharacter: (name: string) => CharacterSheet;
};

export type RulesetUIAdapter = {
  getActionLayout: (viewport: 'desktop' | 'mobile') => RulesetAction[];
  getActionLabels: () => Record<string, string>;
  getActionTooltips: () => Record<string, string>;
  getManeuvers: () => RulesetManeuver[];
  getCloseCombatManeuvers: () => ManeuverType[];
  getAoaVariants: () => RulesetVariant[];
  getAodVariants: () => RulesetVariant[];
  getManeuverInstructions: (maneuver: ManeuverType | null) => ManeuverInstruction | null;
  getTemplateNames: () => string[];
};
