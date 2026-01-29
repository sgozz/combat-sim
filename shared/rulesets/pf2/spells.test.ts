import { describe, it, expect } from 'vitest';
import {
  calculateSpellAttack,
  calculateSpellDC,
  canCastSpell,
} from './rules';
import type { SpellCaster, SpellSlotUsage, Abilities } from './types';

const makeAbilities = (overrides: Partial<Abilities> = {}): Abilities => ({
  strength: 10,
  dexterity: 10,
  constitution: 10,
  intelligence: 18,
  wisdom: 12,
  charisma: 10,
  ...overrides,
});

const makeWizardCaster = (overrides: Partial<SpellCaster> = {}): SpellCaster => ({
  name: 'Arcane Prepared Spells',
  tradition: 'arcane',
  type: 'prepared',
  proficiency: 2, // trained
  slots: [
    { level: 0, total: 5, used: 0 },
    { level: 1, total: 2, used: 0 },
    { level: 2, total: 1, used: 0 },
  ],
  focusPool: { max: 1, current: 1 },
  knownSpells: [
    { level: 0, spells: ['Electric Arc', 'Shield', 'Detect Magic', 'Ray of Frost', 'Prestidigitation'] },
    { level: 1, spells: ['Magic Missile', 'Burning Hands'] },
    { level: 2, spells: ['Fireball'] },
  ],
  ...overrides,
});

const makeClericCaster = (): SpellCaster => ({
  name: 'Divine Prepared Spells',
  tradition: 'divine',
  type: 'prepared',
  proficiency: 2,
  slots: [
    { level: 0, total: 5, used: 0 },
    { level: 1, total: 3, used: 0 },
  ],
  focusPool: { max: 1, current: 1 },
  knownSpells: [
    { level: 0, spells: ['Guidance', 'Stabilize'] },
    { level: 1, spells: ['Heal', 'Bless', 'Sanctuary'] },
  ],
});

describe('Spell Casting', () => {
  describe('calculateSpellAttack', () => {
    it('returns correct bonus for arcane caster (INT + prof + level)', () => {
      const caster = makeWizardCaster();
      const abilities = makeAbilities({ intelligence: 18 }); // +4 mod
      const level = 1;
      // INT mod (4) + trained prof bonus (level 1 + 2 = 3) = 7
      expect(calculateSpellAttack(caster, abilities, level)).toBe(7);
    });

    it('returns correct bonus for divine caster (WIS + prof + level)', () => {
      const caster = makeClericCaster();
      const abilities = makeAbilities({ wisdom: 18 }); // +4 mod
      const level = 1;
      // WIS mod (4) + trained prof bonus (level 1 + 2 = 3) = 7
      expect(calculateSpellAttack(caster, abilities, level)).toBe(7);
    });

    it('returns correct bonus for higher level caster', () => {
      const caster = makeWizardCaster({ proficiency: 4 }); // expert
      const abilities = makeAbilities({ intelligence: 18 }); // +4
      const level = 5;
      // INT mod (4) + expert prof bonus (level 5 + 4 = 9) = 13
      expect(calculateSpellAttack(caster, abilities, level)).toBe(13);
    });

    it('returns 0 for untrained caster with 10 ability', () => {
      const caster = makeWizardCaster({ proficiency: 0 });
      const abilities = makeAbilities({ intelligence: 10 }); // +0 mod
      const level = 1;
      // INT mod (0) + untrained prof bonus (0) = 0
      expect(calculateSpellAttack(caster, abilities, level)).toBe(0);
    });
  });

  describe('calculateSpellDC', () => {
    it('returns 10 + spell attack bonus', () => {
      const caster = makeWizardCaster();
      const abilities = makeAbilities({ intelligence: 18 });
      const level = 1;
      // 10 + 7 = 17
      expect(calculateSpellDC(caster, abilities, level)).toBe(17);
    });

    it('returns 10 for untrained caster with 10 ability', () => {
      const caster = makeWizardCaster({ proficiency: 0 });
      const abilities = makeAbilities({ intelligence: 10 });
      const level = 1;
      expect(calculateSpellDC(caster, abilities, level)).toBe(10);
    });
  });

  describe('canCastSpell - Cantrips', () => {
    it('can cast cantrips unlimited times', () => {
      const caster = makeWizardCaster();
      const slotUsage: SpellSlotUsage[] = [];

      // Cast cantrip many times
      for (let i = 0; i < 10; i++) {
        const result = canCastSpell(caster, 0, 0, slotUsage, 0);
        expect(result.success).toBe(true);
        expect(result.isCantrip).toBe(true);
      }
    });

    it('marks cantrips correctly', () => {
      const caster = makeWizardCaster();
      const result = canCastSpell(caster, 0, 0, [], 0);
      expect(result.success).toBe(true);
      expect(result.isCantrip).toBe(true);
      expect(result.spellLevel).toBe(0);
    });
  });

  describe('canCastSpell - Leveled Spells', () => {
    it('can cast when slots available', () => {
      const caster = makeWizardCaster();
      const result = canCastSpell(caster, 1, 0, [], 0);
      expect(result.success).toBe(true);
      expect(result.spellLevel).toBe(1);
      expect(result.isCantrip).toBeUndefined();
    });

    it('fails when all slots used', () => {
      const caster = makeWizardCaster(); // 2 level-1 slots
      const slotUsage: SpellSlotUsage[] = [
        { casterIndex: 0, level: 1, used: 2 },
      ];
      const result = canCastSpell(caster, 1, 0, slotUsage, 0);
      expect(result.success).toBe(false);
      expect(result.error).toContain('slots remaining');
    });

    it('can cast when some slots still remain', () => {
      const caster = makeWizardCaster(); // 2 level-1 slots
      const slotUsage: SpellSlotUsage[] = [
        { casterIndex: 0, level: 1, used: 1 },
      ];
      const result = canCastSpell(caster, 1, 0, slotUsage, 0);
      expect(result.success).toBe(true);
    });

    it('fails when spell level has no slots', () => {
      const caster = makeWizardCaster();
      // Level 3 doesn't exist in our wizard's slots
      const result = canCastSpell(caster, 3, 0, [], 0);
      expect(result.success).toBe(false);
      expect(result.error).toContain('No spell slots');
    });

    it('tracks slot usage per caster index', () => {
      const caster = makeWizardCaster(); // 2 level-1 slots
      // Slots used for caster index 1, not 0
      const slotUsage: SpellSlotUsage[] = [
        { casterIndex: 1, level: 1, used: 2 },
      ];
      const result = canCastSpell(caster, 1, 0, slotUsage, 0);
      expect(result.success).toBe(true);
    });
  });

  describe('canCastSpell - Focus Spells', () => {
    it('can cast focus spell when points available', () => {
      const caster = makeWizardCaster(); // max focus 1
      const result = canCastSpell(caster, 1, 0, [], 0, true);
      expect(result.success).toBe(true);
      expect(result.isFocus).toBe(true);
    });

    it('fails when no focus points remaining', () => {
      const caster = makeWizardCaster(); // max focus 1
      const result = canCastSpell(caster, 1, 0, [], 1, true); // 1 used of 1 max
      expect(result.success).toBe(false);
      expect(result.error).toContain('focus points');
    });

    it('can cast focus cantrip as cantrip regardless of focus flag', () => {
      const caster = makeWizardCaster();
      // Level 0 is always treated as cantrip, even if isFocus is not set
      const result = canCastSpell(caster, 0, 0, [], 0, false);
      expect(result.success).toBe(true);
      expect(result.isCantrip).toBe(true);
    });
  });

  describe('Tradition-to-ability mapping', () => {
    it('arcane uses intelligence', () => {
      const caster = makeWizardCaster({ tradition: 'arcane' });
      const abilities = makeAbilities({ intelligence: 18, wisdom: 10 });
      const attackWithInt = calculateSpellAttack(caster, abilities, 1);
      // INT mod (4) + trained (3) = 7
      expect(attackWithInt).toBe(7);
    });

    it('divine uses wisdom', () => {
      const caster = makeClericCaster(); // divine tradition
      const abilities = makeAbilities({ wisdom: 18, intelligence: 10 });
      const attack = calculateSpellAttack(caster, abilities, 1);
      // WIS mod (4) + trained (3) = 7
      expect(attack).toBe(7);
    });

    it('occult uses charisma', () => {
      const caster = makeWizardCaster({ tradition: 'occult' });
      const abilities = makeAbilities({ charisma: 16, intelligence: 10 });
      const attack = calculateSpellAttack(caster, abilities, 1);
      // CHA mod (3) + trained (3) = 6
      expect(attack).toBe(6);
    });

    it('primal uses wisdom', () => {
      const caster = makeWizardCaster({ tradition: 'primal' });
      const abilities = makeAbilities({ wisdom: 16, intelligence: 10 });
      const attack = calculateSpellAttack(caster, abilities, 1);
      // WIS mod (3) + trained (3) = 6
      expect(attack).toBe(6);
    });
  });
});
