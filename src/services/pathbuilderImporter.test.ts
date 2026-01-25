import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fetchFromAPI, parseFromFile } from './pathbuilderImporter';

// Fixture data - real Pathbuilder export from API (ID 163111)
const fixture = {
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
    ],
    weapons: [
      {
        name: 'Longsword',
        qty: 1,
        prof: 'martial',
        die: 'd8',
        pot: 0,
        str: '',
        mat: null,
        display: 'Longsword',
        runes: [],
        damageType: 'S',
        attack: 0,
        damageBonus: 0,
        extraDamage: [],
        increasedDice: false,
      },
    ],
    armor: [
      {
        name: 'Hide',
        qty: 1,
        prof: 'medium',
        pot: 0,
        res: '',
        mat: null,
        display: 'Hide',
        worn: true,
        runes: [],
      },
    ],
    acTotal: {
      acProfBonus: 4,
      acAbilityBonus: 0,
      acItemBonus: 3,
      acTotal: 16,
      shieldBonus: null,
    },
    focus: {},
    spellCasters: [],
    pets: [],
    familiars: [],
    formula: [],
  },
};

describe('PathbuilderImporter', () => {
  beforeEach(() => {
    // Mock fetch globally
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          json: () => Promise.resolve(fixture),
        })
      )
    );
  });

  describe('fetchFromAPI', () => {
    it('returns success with character and warnings for valid data', async () => {
      const result = await fetchFromAPI('163111');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.character).toBeDefined();
        expect(result.character.name).toBe('Jordo PF2e Champion Paladin');
        expect(result.character.level).toBe(1);
        expect(result.character.class).toBe('Champion');
        expect(result.warnings).toBeInstanceOf(Array);
      }
    });

    it('returns error for invalid response format', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(() =>
          Promise.resolve({
            json: () => Promise.resolve({ success: false }),
          })
        )
      );

      const result = await fetchFromAPI('invalid');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Invalid Pathbuilder response format');
      }
    });

    it('returns error for network failure', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(() => Promise.reject(new Error('Network error')))
      );

      const result = await fetchFromAPI('163111');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Network error');
      }
    });

    it('returns error for malformed JSON response', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(() =>
          Promise.resolve({
            json: () => Promise.reject(new Error('Invalid JSON')),
          })
        )
      );

      const result = await fetchFromAPI('163111');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Invalid JSON');
      }
    });

    it('includes warnings for pets, familiars, and formulas', async () => {
      const fixtureWithData = {
        ...fixture,
        build: {
          ...fixture.build,
          pets: [{ name: 'Dog' }],
          familiars: [{ name: 'Cat' }],
          formula: [{ name: 'Potion' }],
        },
      };

      vi.stubGlobal(
        'fetch',
        vi.fn(() =>
          Promise.resolve({
            json: () => Promise.resolve(fixtureWithData),
          })
        )
      );

      const result = await fetchFromAPI('163111');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.warnings).toContain('Pets not imported');
        expect(result.warnings).toContain('Familiars not imported');
        expect(result.warnings).toContain('Formulas not imported');
      }
    });
  });

  describe('parseFromFile', () => {
    it('returns success with character for valid JSON file', async () => {
      const file = new File([JSON.stringify(fixture)], 'test.json', {
        type: 'application/json',
      });

      const result = await parseFromFile(file);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.character).toBeDefined();
        expect(result.character.name).toBe('Jordo PF2e Champion Paladin');
        expect(result.character.level).toBe(1);
      }
    });

    it('returns error for invalid JSON format', async () => {
      const file = new File(['{ invalid json'], 'test.json', {
        type: 'application/json',
      });

      const result = await parseFromFile(file);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Invalid JSON file');
      }
    });

    it('returns error for invalid Pathbuilder format', async () => {
      const invalidData = { success: false };
      const file = new File([JSON.stringify(invalidData)], 'test.json', {
        type: 'application/json',
      });

      const result = await parseFromFile(file);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Invalid Pathbuilder JSON format');
      }
    });

    it('returns error for missing required fields', async () => {
      const incompleteData = {
        success: true,
        build: {
          name: 'Test',
          // missing level, abilities, etc.
        },
      };
      const file = new File([JSON.stringify(incompleteData)], 'test.json', {
        type: 'application/json',
      });

      const result = await parseFromFile(file);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Invalid Pathbuilder JSON format');
      }
    });

    it('includes warnings for pets, familiars, and formulas in file', async () => {
      const fixtureWithData = {
        ...fixture,
        build: {
          ...fixture.build,
          pets: [{ name: 'Dog' }],
          familiars: [{ name: 'Cat' }],
          formula: [{ name: 'Potion' }],
        },
      };

      const file = new File([JSON.stringify(fixtureWithData)], 'test.json', {
        type: 'application/json',
      });

      const result = await parseFromFile(file);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.warnings).toContain('Pets not imported');
        expect(result.warnings).toContain('Familiars not imported');
        expect(result.warnings).toContain('Formulas not imported');
      }
    });

    it('returns empty warnings array when no skipped data', async () => {
      const file = new File([JSON.stringify(fixture)], 'test.json', {
        type: 'application/json',
      });

      const result = await parseFromFile(file);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.warnings).toEqual([]);
      }
    });
  });

  describe('Character mapping', () => {
    it('maps character name correctly', async () => {
      const file = new File([JSON.stringify(fixture)], 'test.json', {
        type: 'application/json',
      });

      const result = await parseFromFile(file);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.character.name).toBe('Jordo PF2e Champion Paladin');
      }
    });

    it('maps abilities correctly', async () => {
      const file = new File([JSON.stringify(fixture)], 'test.json', {
        type: 'application/json',
      });

      const result = await parseFromFile(file);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.character.abilities.strength).toBe(16);
        expect(result.character.abilities.dexterity).toBe(10);
        expect(result.character.abilities.constitution).toBe(16);
        expect(result.character.abilities.intelligence).toBe(10);
        expect(result.character.abilities.wisdom).toBe(12);
        expect(result.character.abilities.charisma).toBe(14);
      }
    });

    it('maps derived stats correctly', async () => {
      const file = new File([JSON.stringify(fixture)], 'test.json', {
        type: 'application/json',
      });

      const result = await parseFromFile(file);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.character.derived.hitPoints).toBeGreaterThan(0);
        expect(result.character.derived.armorClass).toBe(16);
        expect(result.character.derived.speed).toBe(25);
      }
    });

    it('maps weapons correctly', async () => {
      const file = new File([JSON.stringify(fixture)], 'test.json', {
        type: 'application/json',
      });

      const result = await parseFromFile(file);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.character.weapons.length).toBeGreaterThan(0);
        expect(result.character.weapons[0].name).toBe('Longsword');
      }
    });

    it('maps armor correctly', async () => {
      const file = new File([JSON.stringify(fixture)], 'test.json', {
        type: 'application/json',
      });

      const result = await parseFromFile(file);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.character.armor).toBeDefined();
        expect(result.character.armor?.name).toBe('Hide');
      }
    });

    it('maps feats correctly', async () => {
      const file = new File([JSON.stringify(fixture)], 'test.json', {
        type: 'application/json',
      });

      const result = await parseFromFile(file);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.character.feats.length).toBeGreaterThan(0);
        expect(result.character.feats.some((f) => f.name === 'Shield Block')).toBe(true);
      }
    });
  });
});
