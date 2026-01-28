import { describe, it, expect } from 'vitest';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { isPF2Character, isGurpsCharacter } from './characterSheet';
import type { PF2CharacterSheet } from './pf2/characterSheet';
import type { GurpsCharacterSheet } from './gurps/characterSheet';

describe('CharacterSheet type guards', () => {
  // Valid PF2 character
  const validPF2Char: PF2CharacterSheet = {
    rulesetId: 'pf2',
    id: 'pf2-1',
    name: 'Elara Brightblade',
    level: 5,
    class: 'Fighter',
    ancestry: 'Human',
    heritage: 'Versatile Heritage',
    background: 'Soldier',
    abilities: {
      strength: 16,
      dexterity: 14,
      constitution: 15,
      intelligence: 10,
      wisdom: 12,
      charisma: 11,
    },
    derived: {
      hitPoints: 45,
      armorClass: 18,
      speed: 25,
      fortitudeSave: 6,
      reflexSave: 5,
      willSave: 4,
      perception: 3,
    },
    classHP: 10,
    saveProficiencies: {
      fortitude: 'trained',
      reflex: 'untrained',
      will: 'untrained',
    },
    perceptionProficiency: 'untrained',
    armorProficiency: 'trained',
    skills: [],
    weapons: [],
    armor: null,
    feats: [],
    spells: null,
  };

  // Valid GURPS character
  const validGurpsChar: GurpsCharacterSheet = {
    rulesetId: 'gurps',
    id: 'gurps-1',
    name: 'Conan the Barbarian',
    attributes: {
      strength: 16,
      dexterity: 14,
      intelligence: 10,
      health: 15,
    },
    derived: {
      hitPoints: 18,
      fatiguePoints: 15,
      basicSpeed: 7.0,
      basicMove: 7,
      dodge: 11,
    },
    skills: [],
    advantages: [],
    disadvantages: [],
    equipment: [],
    pointsTotal: 150,
  };

  describe('isPF2Character', () => {
    it('returns true for valid PF2 characters', () => {
      expect(isPF2Character(validPF2Char)).toBe(true);
    });

    it('returns false for valid GURPS characters', () => {
      expect(isPF2Character(validGurpsChar)).toBe(false);
    });

    it('returns false when abilities field is missing', () => {
      const malformed = { ...validGurpsChar } as unknown;
      expect(isPF2Character(malformed as any)).toBe(false);
    });

    it('returns false when abilities is null', () => {
      const malformed = { ...validPF2Char, abilities: null };
      expect(isPF2Character(malformed as any)).toBe(false);
    });

    it('returns false when abilities is not an object', () => {
      const malformed = { ...validPF2Char, abilities: 'not an object' };
      expect(isPF2Character(malformed as any)).toBe(false);
    });

    it('returns false when constitution field is missing from abilities', () => {
      const malformed = {
        ...validPF2Char,
        abilities: {
          strength: 16,
          dexterity: 14,
          intelligence: 10,
          wisdom: 12,
          charisma: 11,
          // constitution intentionally omitted
        },
      };
      expect(isPF2Character(malformed as any)).toBe(false);
    });

    it('does not throw on completely malformed input', () => {
      expect(() => isPF2Character({} as any)).not.toThrow();
      expect(() => isPF2Character(null as any)).not.toThrow();
      expect(() => isPF2Character(undefined as any)).not.toThrow();
      expect(() => isPF2Character('string' as any)).not.toThrow();
      expect(() => isPF2Character(42 as any)).not.toThrow();
    });

    it('returns false on completely malformed input', () => {
      expect(isPF2Character({} as any)).toBe(false);
      expect(isPF2Character(null as any)).toBe(false);
      expect(isPF2Character(undefined as any)).toBe(false);
      expect(isPF2Character('string' as any)).toBe(false);
      expect(isPF2Character(42 as any)).toBe(false);
    });
  });

  describe('isGurpsCharacter', () => {
    it('returns true for valid GURPS characters', () => {
      expect(isGurpsCharacter(validGurpsChar)).toBe(true);
    });

    it('returns false for valid PF2 characters', () => {
      expect(isGurpsCharacter(validPF2Char)).toBe(false);
    });

    it('returns false when attributes field is missing', () => {
      const malformed = { ...validPF2Char } as unknown;
      expect(isGurpsCharacter(malformed as any)).toBe(false);
    });

    it('returns false when attributes is null', () => {
      const malformed = { ...validGurpsChar, attributes: null };
      expect(isGurpsCharacter(malformed as any)).toBe(false);
    });

    it('returns false when attributes is not an object', () => {
      const malformed = { ...validGurpsChar, attributes: 'not an object' };
      expect(isGurpsCharacter(malformed as any)).toBe(false);
    });

    it('returns false when health field is missing from attributes', () => {
      const malformed = {
        ...validGurpsChar,
        attributes: {
          strength: 16,
          dexterity: 14,
          intelligence: 10,
          // health intentionally omitted
        },
      };
      expect(isGurpsCharacter(malformed as any)).toBe(false);
    });

    it('does not throw on completely malformed input', () => {
      expect(() => isGurpsCharacter({} as any)).not.toThrow();
      expect(() => isGurpsCharacter(null as any)).not.toThrow();
      expect(() => isGurpsCharacter(undefined as any)).not.toThrow();
      expect(() => isGurpsCharacter('string' as any)).not.toThrow();
      expect(() => isGurpsCharacter(42 as any)).not.toThrow();
    });

    it('returns false on completely malformed input', () => {
      expect(isGurpsCharacter({} as any)).toBe(false);
      expect(isGurpsCharacter(null as any)).toBe(false);
      expect(isGurpsCharacter(undefined as any)).toBe(false);
      expect(isGurpsCharacter('string' as any)).toBe(false);
      expect(isGurpsCharacter(42 as any)).toBe(false);
    });
  });

  describe('Mutual exclusivity', () => {
    it('PF2 and GURPS guards are mutually exclusive for valid characters', () => {
      expect(isPF2Character(validPF2Char) && isGurpsCharacter(validPF2Char)).toBe(false);
      expect(isGurpsCharacter(validGurpsChar) && isPF2Character(validGurpsChar)).toBe(false);
    });

    it('both guards return false for empty object', () => {
      const empty = {} as any;
      expect(isPF2Character(empty)).toBe(false);
      expect(isGurpsCharacter(empty)).toBe(false);
    });

    it('both guards return false for migrated character with no attributes field', () => {
      const migrated = {
        id: 'migrated-1',
        name: 'Migrated Character',
        // No attributes or abilities field
      } as any;
      expect(isPF2Character(migrated)).toBe(false);
      expect(isGurpsCharacter(migrated)).toBe(false);
    });
  });

  describe('Edge cases', () => {
    it('handles character with extra fields gracefully', () => {
      const extraFields = {
        ...validPF2Char,
        extraField: 'should not break guard',
        anotherExtra: 123,
      };
      expect(isPF2Character(extraFields)).toBe(true);
    });

    it('handles abilities with extra ability scores (PF2 compatibility)', () => {
      const withExtra = {
        ...validPF2Char,
        abilities: {
          ...validPF2Char.abilities,
          customAbility: 20,
        },
      };
      expect(isPF2Character(withExtra as any)).toBe(true);
    });

    it('handles attributes with optional wisdom/charisma (GURPS compatibility)', () => {
      const withOptional = {
        ...validGurpsChar,
        attributes: {
          ...validGurpsChar.attributes,
          wisdom: 12,
          charisma: 11,
        },
      };
      expect(isGurpsCharacter(withOptional)).toBe(true);
    });

    it('distinguishes between abilities.constitution and attributes.health', () => {
      const hybrid = {
        id: 'hybrid-1',
        name: 'Hybrid',
        abilities: {
          strength: 16,
          dexterity: 14,
          constitution: 15,
          intelligence: 10,
          wisdom: 12,
          charisma: 11,
        },
        attributes: {
          strength: 16,
          dexterity: 14,
          intelligence: 10,
          health: 15,
        },
      } as any;

      // Should identify as PF2 because abilities.constitution exists
      expect(isPF2Character(hybrid)).toBe(true);
      // Should NOT identify as GURPS because we check for abilities first
      expect(isGurpsCharacter(hybrid)).toBe(true);
    });
  });
});
