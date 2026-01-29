import { describe, it, expect } from 'vitest';
import {
  getConditionACModifier,
  getConditionAttackModifier,
  hasCondition,
  formatConditionModifiers,
} from './conditions';
import type { PF2CombatantState } from './types';

const baseCombatant: PF2CombatantState = {
  rulesetId: 'pf2', playerId: '1', characterId: '1',
  position: { x: 0, y: 0, z: 0 }, facing: 0,
  actionsRemaining: 3, reactionAvailable: true, mapPenalty: 0,
  conditions: [], currentHP: 20, tempHP: 0, shieldRaised: false,
  heroPoints: 1, dying: 0, wounded: 0, doomed: 0,
  statusEffects: [], usedReaction: false,
};

const withConditions = (conditions: PF2CombatantState['conditions']): PF2CombatantState => ({
  ...baseCombatant,
  conditions,
});

describe('PF2 Conditions', () => {
  describe('getConditionACModifier', () => {
    it('returns 0 with no conditions', () => {
      expect(getConditionACModifier(baseCombatant, 'melee')).toBe(0);
      expect(getConditionACModifier(baseCombatant, 'ranged')).toBe(0);
    });

    it('prone gives -2 AC vs melee', () => {
      const combatant = withConditions([{ condition: 'prone' }]);
      expect(getConditionACModifier(combatant, 'melee')).toBe(-2);
    });

    it('prone gives +2 AC vs ranged', () => {
      const combatant = withConditions([{ condition: 'prone' }]);
      expect(getConditionACModifier(combatant, 'ranged')).toBe(2);
    });

    it('flat_footed gives -2 AC regardless of attack type', () => {
      const combatant = withConditions([{ condition: 'flat_footed' }]);
      expect(getConditionACModifier(combatant, 'melee')).toBe(-2);
      expect(getConditionACModifier(combatant, 'ranged')).toBe(-2);
    });

    it('prone + flat_footed stack for melee (-4 total)', () => {
      const combatant = withConditions([
        { condition: 'prone' },
        { condition: 'flat_footed' },
      ]);
      expect(getConditionACModifier(combatant, 'melee')).toBe(-4);
    });

    it('prone + flat_footed for ranged (net 0: +2 prone, -2 flat_footed)', () => {
      const combatant = withConditions([
        { condition: 'prone' },
        { condition: 'flat_footed' },
      ]);
      expect(getConditionACModifier(combatant, 'ranged')).toBe(0);
    });
  });

  describe('getConditionAttackModifier', () => {
    it('returns 0 with no conditions', () => {
      expect(getConditionAttackModifier(baseCombatant)).toBe(0);
    });

    it('prone gives -2 attack', () => {
      const combatant = withConditions([{ condition: 'prone' }]);
      expect(getConditionAttackModifier(combatant)).toBe(-2);
    });

    it('flat_footed does not affect attack rolls', () => {
      const combatant = withConditions([{ condition: 'flat_footed' }]);
      expect(getConditionAttackModifier(combatant)).toBe(0);
    });
  });

  describe('hasCondition', () => {
    it('returns false when condition not present', () => {
      expect(hasCondition(baseCombatant, 'prone')).toBe(false);
    });

    it('returns true when condition present', () => {
      const combatant = withConditions([{ condition: 'prone' }]);
      expect(hasCondition(combatant, 'prone')).toBe(true);
    });
  });

  describe('formatConditionModifiers', () => {
    it('returns empty string when no modifiers', () => {
      expect(formatConditionModifiers(0, 0)).toBe('');
    });

    it('formats attack modifier only', () => {
      expect(formatConditionModifiers(-2, 0)).toBe(' [conditions: attack -2]');
    });

    it('formats AC modifier only', () => {
      expect(formatConditionModifiers(0, -2)).toBe(' [conditions: AC -2]');
    });

    it('formats both modifiers', () => {
      expect(formatConditionModifiers(-2, -4)).toBe(' [conditions: attack -2, AC -4]');
    });

    it('formats positive AC modifier', () => {
      expect(formatConditionModifiers(0, 2)).toBe(' [conditions: AC +2]');
    });
  });
});
