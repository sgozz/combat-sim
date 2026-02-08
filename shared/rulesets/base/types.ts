import type { Id, GridPosition, RulesetId } from '../../types';

/**
 * Universal combatant state fields shared by all rulesets (GURPS, PF2, etc.)
 * This is the foundation that ruleset-specific types extend.
 */
export type BaseCombatantState = {
  playerId: Id;
  characterId: Id;
  rulesetId: RulesetId;
  position: GridPosition;
  facing: number;
  currentHP: number;
  statusEffects: string[];
  usedReaction: boolean;
  /** Path of grid positions for movement animation (cleared after each move). */
  movementPath?: GridPosition[];
};
