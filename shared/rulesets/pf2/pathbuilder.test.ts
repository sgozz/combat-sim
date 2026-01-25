import { describe, it, expect } from 'vitest';
import { validatePathbuilderExport, type PathbuilderExport } from './pathbuilder';

const fixtureData = {
  success: true,
  build: {
    name: 'Jordo PF2e Champion Paladin',
    class: 'Champion',
    dualClass: null,
    level: 1,
    ancestry: 'Human',
    heritage: 'Nephilim',
    background: 'Squire (Warfare)',
    alignment: 'N',
    gender: 'Male',
    age: 'Not set',
    deity: 'Not set',
    size: 2,
    sizeName: 'Medium',
    keyability: 'str',
    languages: ['Common', 'Fey'],
    rituals: [],
    resistances: [],
    inventorMods: [],
    attributes: {
      ancestryhp: 8,
      classhp: 10,
      bonushp: 0,
      bonushpPerLevel: 0,
      speed: 25,
      speedBonus: 0,
    },
    abilities: {
      str: 16,
      dex: 10,
      con: 16,
      int: 10,
      wis: 12,
      cha: 14,
      breakdown: {
        ancestryFree: ['Str', 'Con'],
        ancestryBoosts: [],
        ancestryFlaws: [],
        backgroundBoosts: ['Con', 'Cha'],
        classBoosts: ['Str'],
        mapLevelledBoosts: {
          '1': ['Str', 'Wis', 'Con', 'Cha'],
        },
      },
    },
    proficiencies: {
      classDC: 2,
      perception: 2,
      fortitude: 4,
      reflex: 2,
      will: 4,
      heavy: 2,
      medium: 2,
      light: 2,
      unarmored: 2,
      advanced: 0,
      martial: 2,
      simple: 2,
      unarmed: 2,
      castingArcane: 0,
      castingDivine: 2,
      castingOccult: 0,
      castingPrimal: 0,
      acrobatics: 0,
      arcana: 0,
      athletics: 2,
      crafting: 0,
      deception: 0,
      diplomacy: 2,
      intimidation: 2,
      medicine: 0,
      nature: 0,
      occultism: 2,
      performance: 0,
      religion: 2,
      society: 0,
      stealth: 0,
      survival: 0,
      thievery: 0,
    },
    mods: {},
    feats: [
      ['Shield Block', null, 'Awarded Feat', 1],
      ['Armor Assist', null, 'Awarded Feat', 1],
      ['Nephilim', null, 'Heritage', 1, 'Heritage Feat', 'standardChoice', null],
      ['Lawbringer', null, 'Ancestry Feat', 1, 'Human Feat 1', 'standardChoice', null],
      ['Ranged Reprisal', null, 'Class Feat', 1, 'Champion Feat 1', 'standardChoice', null],
    ],
    specials: [
      'Retributive Strike',
      'Tenets of Good',
      "Champion's Code",
      'Devotion Spells',
      'Low-Light Vision',
      'Paladin [Lawful Good]',
      'Deific Weapon',
      'Nephilim',
    ],
    lores: [['Warfare', 2]],
    equipmentContainers: {
      'b9360662-54d6-454b-b87f-925ba2e75036': {
        containerName: 'Backpack',
        bagOfHolding: false,
        backpack: true,
      },
    },
    equipment: [
      ['Backpack', 1, 'Invested'],
      ['Bedroll', 1, 'b9360662-54d6-454b-b87f-925ba2e75036', 'Invested'],
      ['Chalk', 10, 'b9360662-54d6-454b-b87f-925ba2e75036', 'Invested'],
      ['Flint and Steel', 1, 'b9360662-54d6-454b-b87f-925ba2e75036', 'Invested'],
      ['Rope', 1, 'b9360662-54d6-454b-b87f-925ba2e75036', 'Invested'],
      ['Waterskin', 1, 'b9360662-54d6-454b-b87f-925ba2e75036', 'Invested'],
      ['Longsword', 1, 'Invested'],
      ['Plate Armor', 1, 'Invested'],
      ['Shield', 1, 'Invested'],
      ['Dagger', 1, 'Invested'],
      ['Pouch', 1, 'Invested'],
    ],
  },
};

describe('Pathbuilder validation', () => {
  describe('validatePathbuilderExport', () => {
    it('should validate a valid Pathbuilder export', () => {
      const result = validatePathbuilderExport(fixtureData);
      expect(result).not.toBeNull();
      expect(result?.success).toBe(true);
      expect(result?.build.name).toBe('Jordo PF2e Champion Paladin');
      expect(result?.build.level).toBe(1);
    });

    it('should return typed object with correct structure', () => {
      const result = validatePathbuilderExport(fixtureData) as PathbuilderExport;
      expect(result.build.name).toBeDefined();
      expect(result.build.level).toBeDefined();
      expect(result.build.abilities).toBeDefined();
      expect(result.build.proficiencies).toBeDefined();
    });

    it('should validate all 6 ability scores in fixture', () => {
      const result = validatePathbuilderExport(fixtureData) as PathbuilderExport;
      expect(result.build.abilities.str).toBe(16);
      expect(result.build.abilities.dex).toBe(10);
      expect(result.build.abilities.con).toBe(16);
      expect(result.build.abilities.int).toBe(10);
      expect(result.build.abilities.wis).toBe(12);
      expect(result.build.abilities.cha).toBe(14);
    });

    it('should reject data without success field', () => {
      const invalid = { build: { name: 'Test', level: 1, abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencies: {} } };
      expect(validatePathbuilderExport(invalid)).toBeNull();
    });

    it('should reject data with success !== true', () => {
      const invalid = { success: false, build: { name: 'Test', level: 1, abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencies: {} } };
      expect(validatePathbuilderExport(invalid)).toBeNull();
    });

    it('should reject data without build field', () => {
      const invalid = { success: true };
      expect(validatePathbuilderExport(invalid)).toBeNull();
    });

    it('should reject data with null build', () => {
      const invalid = { success: true, build: null };
      expect(validatePathbuilderExport(invalid)).toBeNull();
    });

    it('should reject build with empty name', () => {
      const invalid = { success: true, build: { name: '', level: 1, abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencies: {} } };
      expect(validatePathbuilderExport(invalid)).toBeNull();
    });

    it('should reject build with whitespace-only name', () => {
      const invalid = { success: true, build: { name: '   ', level: 1, abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencies: {} } };
      expect(validatePathbuilderExport(invalid)).toBeNull();
    });

    it('should reject build with non-string name', () => {
      const invalid = { success: true, build: { name: 123, level: 1, abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencies: {} } };
      expect(validatePathbuilderExport(invalid)).toBeNull();
    });

    it('should reject build with level < 1', () => {
      const invalid = { success: true, build: { name: 'Test', level: 0, abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencies: {} } };
      expect(validatePathbuilderExport(invalid)).toBeNull();
    });

    it('should reject build with level > 20', () => {
      const invalid = { success: true, build: { name: 'Test', level: 21, abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencies: {} } };
      expect(validatePathbuilderExport(invalid)).toBeNull();
    });

    it('should reject build with non-number level', () => {
      const invalid = { success: true, build: { name: 'Test', level: '1', abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencies: {} } };
      expect(validatePathbuilderExport(invalid)).toBeNull();
    });

    it('should accept level 1', () => {
      const valid = { success: true, build: { name: 'Test', level: 1, abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencies: {} } };
      expect(validatePathbuilderExport(valid)).not.toBeNull();
    });

    it('should accept level 20', () => {
      const valid = { success: true, build: { name: 'Test', level: 20, abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencies: {} } };
      expect(validatePathbuilderExport(valid)).not.toBeNull();
    });

    it('should reject build without abilities', () => {
      const invalid = { success: true, build: { name: 'Test', level: 1, proficiencies: {} } };
      expect(validatePathbuilderExport(invalid)).toBeNull();
    });

    it('should reject build with null abilities', () => {
      const invalid = { success: true, build: { name: 'Test', level: 1, abilities: null, proficiencies: {} } };
      expect(validatePathbuilderExport(invalid)).toBeNull();
    });

    it('should reject build with missing str ability', () => {
      const invalid = { success: true, build: { name: 'Test', level: 1, abilities: { dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencies: {} } };
      expect(validatePathbuilderExport(invalid)).toBeNull();
    });

    it('should reject build with missing dex ability', () => {
      const invalid = { success: true, build: { name: 'Test', level: 1, abilities: { str: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencies: {} } };
      expect(validatePathbuilderExport(invalid)).toBeNull();
    });

    it('should reject build with missing con ability', () => {
      const invalid = { success: true, build: { name: 'Test', level: 1, abilities: { str: 10, dex: 10, int: 10, wis: 10, cha: 10 }, proficiencies: {} } };
      expect(validatePathbuilderExport(invalid)).toBeNull();
    });

    it('should reject build with missing int ability', () => {
      const invalid = { success: true, build: { name: 'Test', level: 1, abilities: { str: 10, dex: 10, con: 10, wis: 10, cha: 10 }, proficiencies: {} } };
      expect(validatePathbuilderExport(invalid)).toBeNull();
    });

    it('should reject build with missing wis ability', () => {
      const invalid = { success: true, build: { name: 'Test', level: 1, abilities: { str: 10, dex: 10, con: 10, int: 10, cha: 10 }, proficiencies: {} } };
      expect(validatePathbuilderExport(invalid)).toBeNull();
    });

    it('should reject build with missing cha ability', () => {
      const invalid = { success: true, build: { name: 'Test', level: 1, abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10 }, proficiencies: {} } };
      expect(validatePathbuilderExport(invalid)).toBeNull();
    });

    it('should reject build with non-number ability score', () => {
      const invalid = { success: true, build: { name: 'Test', level: 1, abilities: { str: '10', dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencies: {} } };
      expect(validatePathbuilderExport(invalid)).toBeNull();
    });

    it('should reject build without proficiencies', () => {
      const invalid = { success: true, build: { name: 'Test', level: 1, abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } } };
      expect(validatePathbuilderExport(invalid)).toBeNull();
    });

    it('should reject build with null proficiencies', () => {
      const invalid = { success: true, build: { name: 'Test', level: 1, abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencies: null } };
      expect(validatePathbuilderExport(invalid)).toBeNull();
    });

    it('should reject null input', () => {
      expect(validatePathbuilderExport(null)).toBeNull();
    });

    it('should reject undefined input', () => {
      expect(validatePathbuilderExport(undefined)).toBeNull();
    });

    it('should reject string input', () => {
      expect(validatePathbuilderExport('not an object')).toBeNull();
    });

    it('should reject number input', () => {
      expect(validatePathbuilderExport(123)).toBeNull();
    });

    it('should reject array input', () => {
      expect(validatePathbuilderExport([])).toBeNull();
    });

    it('should reject malformed JSON', () => {
      expect(validatePathbuilderExport({ success: true, build: { name: 'Test' } })).toBeNull();
    });

    it('should accept proficiencies with extra fields', () => {
      const valid = { success: true, build: { name: 'Test', level: 1, abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencies: { perception: 2, fortitude: 4, extraField: 99 } } };
      expect(validatePathbuilderExport(valid)).not.toBeNull();
    });

    it('should accept build with optional fields', () => {
      const valid = { success: true, build: { name: 'Test', level: 1, abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencies: {}, class: 'Fighter', ancestry: 'Human' } };
      expect(validatePathbuilderExport(valid)).not.toBeNull();
    });
  });
});
