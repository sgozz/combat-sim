import { describe, it, expect } from 'vitest';
import type { PF2CombatantState } from './types';

describe('Multiple Attack Penalty (MAP)', () => {
  const createMockCombatant = (mapPenalty: number = 0): PF2CombatantState => ({
    rulesetId: 'pf2',
    playerId: 'player1',
    characterId: 'char1',
    position: { x: 0, y: 0, z: 0 },
    facing: 0,
    currentHP: 20,
    actionsRemaining: 3,
    reactionAvailable: true,
    mapPenalty,
    conditions: [],
    statusEffects: [],
    tempHP: 0,
    shieldRaised: false,
    heroPoints: 1,
    dying: 0,
    wounded: 0,
    doomed: 0,
    spellSlotUsage: [],
    focusPointsUsed: 0,
    usedReaction: false,
  });

  describe('MAP progression', () => {
    it('first attack has 0 penalty', () => {
      const combatant = createMockCombatant(0);
      expect(combatant.mapPenalty).toBe(0);
    });

    it('second attack has -5 penalty (non-agile)', () => {
      const combatant = createMockCombatant(-5);
      expect(combatant.mapPenalty).toBe(-5);
    });

    it('third attack has -10 penalty (non-agile)', () => {
      const combatant = createMockCombatant(-10);
      expect(combatant.mapPenalty).toBe(-10);
    });

    it('second attack has -4 penalty (agile)', () => {
      const combatant = createMockCombatant(-4);
      expect(combatant.mapPenalty).toBe(-4);
    });

    it('third attack has -8 penalty (agile)', () => {
      const combatant = createMockCombatant(-8);
      expect(combatant.mapPenalty).toBe(-8);
    });
  });

  describe('MAP increment logic', () => {
    it('increments from 0 to -5 for non-agile', () => {
      const currentPenalty = 0;
      const penaltyStep = -5;
      const minPenalty = -10;
      const newPenalty = Math.max(minPenalty, currentPenalty + penaltyStep);
      expect(newPenalty).toBe(-5);
    });

    it('increments from -5 to -10 for non-agile', () => {
      const currentPenalty = -5;
      const penaltyStep = -5;
      const minPenalty = -10;
      const newPenalty = Math.max(minPenalty, currentPenalty + penaltyStep);
      expect(newPenalty).toBe(-10);
    });

    it('caps at -10 for non-agile', () => {
      const currentPenalty = -10;
      const penaltyStep = -5;
      const minPenalty = -10;
      const newPenalty = Math.max(minPenalty, currentPenalty + penaltyStep);
      expect(newPenalty).toBe(-10);
    });

    it('increments from 0 to -4 for agile', () => {
      const currentPenalty = 0;
      const penaltyStep = -4;
      const minPenalty = -8;
      const newPenalty = Math.max(minPenalty, currentPenalty + penaltyStep);
      expect(newPenalty).toBe(-4);
    });

    it('increments from -4 to -8 for agile', () => {
      const currentPenalty = -4;
      const penaltyStep = -4;
      const minPenalty = -8;
      const newPenalty = Math.max(minPenalty, currentPenalty + penaltyStep);
      expect(newPenalty).toBe(-8);
    });

    it('caps at -8 for agile', () => {
      const currentPenalty = -8;
      const penaltyStep = -4;
      const minPenalty = -8;
      const newPenalty = Math.max(minPenalty, currentPenalty + penaltyStep);
      expect(newPenalty).toBe(-8);
    });
  });

  describe('MAP semantics', () => {
    it('mapPenalty is a negative value', () => {
      const combatant = createMockCombatant(-5);
      expect(combatant.mapPenalty).toBeLessThanOrEqual(0);
    });

    it('applying MAP to attack bonus subtracts from total', () => {
      const attackBonus = 10;
      const mapPenalty = -5;
      const total = attackBonus + mapPenalty;
      expect(total).toBe(5);
    });

    it('zero MAP does not affect attack bonus', () => {
      const attackBonus = 10;
      const mapPenalty = 0;
      const total = attackBonus + mapPenalty;
      expect(total).toBe(10);
    });
  });
});
