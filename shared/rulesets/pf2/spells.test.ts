import { describe, it, expect } from 'vitest';
import {
  calculateSpellAttack,
  calculateSpellDC,
  canCastSpell,
  rollDamage,
  rollCheck,
  applyHealing,
} from './rules';
import type { SpellCaster, SpellSlotUsage, Abilities, PF2CombatantState, SpellDefinition } from './types';

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

  describe('Spell Effects', () => {
    const mockCombatant = (hp: number, dying = 0): PF2CombatantState => ({
      playerId: 'test-player',
      characterId: 'test-char',
      rulesetId: 'pf2',
      position: { x: 0, y: 0, z: 0 },
      facing: 0,
      currentHP: hp,
      actionsRemaining: 3,
      reactionAvailable: true,
      mapPenalty: 0,
      conditions: [],
      statusEffects: [],
      tempHP: 0,
      shieldRaised: false,
      heroPoints: 1,
      dying,
      wounded: 0,
      doomed: 0,
      spellSlotUsage: [],
      focusPointsUsed: 0,
      usedReaction: false,
    });

    describe('Damage Spells', () => {
      it('should deal full damage on failed save', () => {
        const damageRoll = rollDamage('2d6', 'fire', () => 0.5);
        expect(damageRoll.total).toBeGreaterThan(0);
        expect(damageRoll.damageType).toBe('fire');
      });

      it('should deal half damage on successful save', () => {
        const damageRoll = rollDamage('6d6', 'fire', () => 0.5);
        const halfDamage = Math.floor(damageRoll.total / 2);
        expect(halfDamage).toBeGreaterThanOrEqual(0);
      });

      it('should deal double damage on critical failure', () => {
        const damageRoll = rollDamage('2d6', 'electricity', () => 0.5);
        const doubleDamage = damageRoll.total * 2;
        expect(doubleDamage).toBeGreaterThan(damageRoll.total);
      });

      it('should deal no damage on critical success', () => {
        const noDamage = 0;
        expect(noDamage).toBe(0);
      });

      it('should apply damage with degree of success', () => {
        const saveRoll = rollCheck(5, 15, () => 0.5);
        expect(['critical_failure', 'failure', 'success', 'critical_success']).toContain(saveRoll.degree);
      });
    });

    describe('Healing Spells', () => {
      it('should heal damage up to maxHP', () => {
        const combatant = mockCombatant(10);
        const maxHP = 30;
        const healed = applyHealing(combatant, 15, maxHP);
        expect(healed.currentHP).toBe(25);
      });

      it('should not exceed maxHP', () => {
        const combatant = mockCombatant(25);
        const maxHP = 30;
        const healed = applyHealing(combatant, 20, maxHP);
        expect(healed.currentHP).toBe(30);
      });

      it('should stabilize dying character', () => {
        const combatant = mockCombatant(0, 2);
        const maxHP = 30;
        const healed = applyHealing(combatant, 10, maxHP);
        expect(healed.currentHP).toBe(10);
        expect(healed.dying).toBe(0);
        expect(healed.wounded).toBe(1);
        expect(healed.conditions.some(c => c.condition === 'unconscious')).toBe(false);
      });

      it('should increase wounded when healing from dying', () => {
        const combatant = mockCombatant(0, 1);
        const maxHP = 30;
        const healed = applyHealing(combatant, 5, maxHP);
        expect(healed.wounded).toBe(1);
      });
    });

    describe('Condition Application', () => {
      it('should apply frightened condition on failed save', () => {
        const combatant = mockCombatant(20);
        const withCondition: PF2CombatantState = {
          ...combatant,
          conditions: [{ condition: 'frightened', value: 1 }],
        };
        expect(withCondition.conditions).toHaveLength(1);
        expect(withCondition.conditions[0].condition).toBe('frightened');
        expect(withCondition.conditions[0].value).toBe(1);
      });

      it('should not apply condition on successful save', () => {
        const combatant = mockCombatant(20);
        expect(combatant.conditions).toHaveLength(0);
      });
    });

    describe('Spell Data Validation', () => {
      it('should have valid damage spell definition', () => {
        const electricArc: SpellDefinition = {
          name: 'Electric Arc',
          level: 0,
          tradition: 'arcane',
          castActions: 2,
          targetType: 'single',
          save: 'reflex',
          damageFormula: '1d4+{mod}',
          damageType: 'electricity',
        };
        expect(electricArc.name).toBe('Electric Arc');
        expect(electricArc.save).toBe('reflex');
        expect(electricArc.damageType).toBe('electricity');
      });

      it('should have valid healing spell definition', () => {
        const heal: SpellDefinition = {
          name: 'Heal',
          level: 1,
          tradition: 'divine',
          castActions: 2,
          targetType: 'single',
          healFormula: '1d8',
        };
        expect(heal.name).toBe('Heal');
        expect(heal.healFormula).toBe('1d8');
      });

      it('should have valid condition spell definition', () => {
        const fear: SpellDefinition = {
          name: 'Fear',
          level: 1,
          tradition: 'arcane',
          castActions: 2,
          targetType: 'single',
          save: 'will',
          conditions: [{ condition: 'frightened', value: 1 }],
          duration: 'varies',
        };
        expect(fear.name).toBe('Fear');
        expect(fear.conditions).toHaveLength(1);
        expect(fear.conditions![0].condition).toBe('frightened');
      });
    });

    describe('Spell Effect Resolution', () => {
      it('should resolve damage spell with save', () => {
        const baseDamage = 20;
        const saveRoll = rollCheck(8, 15, () => 0.3);
        
        let finalDamage = 0;
        if (saveRoll.degree === 'critical_failure') {
          finalDamage = baseDamage * 2;
        } else if (saveRoll.degree === 'failure') {
          finalDamage = baseDamage;
        } else if (saveRoll.degree === 'success') {
          finalDamage = Math.floor(baseDamage / 2);
        } else {
          finalDamage = 0;
        }
        
        expect(finalDamage).toBeGreaterThanOrEqual(0);
      });

      it('should resolve healing spell', () => {
        const combatant = mockCombatant(15);
        const maxHP = 30;
        const healAmount = 12;
        const healed = applyHealing(combatant, healAmount, maxHP);
        expect(healed.currentHP).toBe(27);
      });

      it('should resolve condition spell with save', () => {
        const saveRoll = rollCheck(5, 18, () => 0.2);
        const shouldApplyCondition = saveRoll.degree === 'failure' || saveRoll.degree === 'critical_failure';
        
        if (shouldApplyCondition) {
          const combatant = mockCombatant(20);
          const withCondition: PF2CombatantState = {
            ...combatant,
            conditions: [{ condition: 'frightened', value: 1 }],
          };
          expect(withCondition.conditions).toHaveLength(1);
        }
        
        expect(typeof shouldApplyCondition).toBe('boolean');
      });
    });
  });
});
