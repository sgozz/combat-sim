import type { Id, GridPosition } from '../../types';

/**
 * Universal combatant state fields shared by all rulesets (GURPS, PF2, etc.)
 * This is the foundation that ruleset-specific types extend.
 */
export type BaseCombatantState = {
  playerId: Id;
  characterId: Id;
  position: GridPosition;
  facing: number;
  currentHP: number;
  statusEffects: string[];
  usedReaction: boolean;
};
