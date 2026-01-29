import { describe, it, expect } from 'vitest';
import { isGurpsCombatant, isPF2Combatant, getGridType } from './index';
import { isGurpsCharacter, isPF2Character } from './characterSheet';
import type { BaseCombatantState } from './base/types';
import type { GurpsCharacterSheet } from './gurps/characterSheet';
import type { PF2CharacterSheet } from './pf2/characterSheet';

describe('Ruleset type guards', () => {
  const baseCombatant: BaseCombatantState = {
    rulesetId: 'gurps',
    playerId: 'player-1',
    characterId: 'character-1',
    position: { x: 0, y: 0, z: 0 },
    facing: 0,
    currentHP: 10,
    statusEffects: [],
    usedReaction: false,
  };

  const gurpsCombatant: BaseCombatantState & { maneuver: null } = {
    ...baseCombatant,
    maneuver: null,
  };

  const pf2Combatant: BaseCombatantState & { actionsRemaining: number } = {
    ...baseCombatant,
    actionsRemaining: 3,
  };

  const gurpsCharacter = {
    rulesetId: 'gurps' as const,
    id: 'gurps-1',
    name: 'Gurps Test',
    attributes: {
      strength: 10,
      dexterity: 10,
      intelligence: 10,
      health: 10,
    },
    derived: {
      hitPoints: 10,
      fatiguePoints: 10,
      basicSpeed: 5,
      basicMove: 5,
      dodge: 8,
    },
    skills: [],
    advantages: [],
    disadvantages: [],
    equipment: [],
    pointsTotal: 0,
  } satisfies GurpsCharacterSheet;

  const pf2Character = {
    rulesetId: 'pf2' as const,
    id: 'pf2-1',
    name: 'PF2 Test',
    level: 1,
    class: 'Fighter',
    ancestry: 'Human',
    heritage: 'Versatile Heritage',
    background: 'Soldier',
    abilities: {
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    },
    derived: {
      hitPoints: 10,
      armorClass: 15,
      speed: 25,
      fortitudeSave: 2,
      reflexSave: 2,
      willSave: 2,
      perception: 2,
    },
    classHP: 10,
    saveProficiencies: {
      fortitude: 'trained',
      reflex: 'trained',
      will: 'trained',
    },
    perceptionProficiency: 'trained',
    armorProficiency: 'trained',
    skills: [],
    weapons: [],
    armor: null,
    shieldBonus: 0,
    feats: [],
    spells: null,
    spellcasters: [],
  } satisfies PF2CharacterSheet;

  describe('combatant guards', () => {
    it('identifies GURPS combatants by maneuver', () => {
      expect(isGurpsCombatant(gurpsCombatant)).toBe(true);
    });

    it('identifies PF2 combatants by actionsRemaining', () => {
      expect(isPF2Combatant(pf2Combatant)).toBe(true);
    });

    it('returns false for GURPS combatant in PF2 guard', () => {
      expect(isPF2Combatant(gurpsCombatant)).toBe(false);
    });

    it('returns false for PF2 combatant in GURPS guard', () => {
      expect(isGurpsCombatant(pf2Combatant)).toBe(false);
    });
  });

  describe('character guards', () => {
    it('identifies GURPS characters by attributes.health', () => {
      expect(isGurpsCharacter(gurpsCharacter)).toBe(true);
    });

    it('identifies PF2 characters by abilities.constitution', () => {
      expect(isPF2Character(pf2Character)).toBe(true);
    });

    it('returns false for PF2 character in GURPS guard', () => {
      expect(isGurpsCharacter(pf2Character)).toBe(false);
    });

    it('returns false for GURPS character in PF2 guard', () => {
      expect(isPF2Character(gurpsCharacter)).toBe(false);
    });

     it('returns false when required fields are missing', () => {
       const missingAbilities = { ...pf2Character } as unknown as PF2CharacterSheet;
       delete (missingAbilities as { abilities?: unknown }).abilities;
       const missingAttributes = { ...gurpsCharacter } as unknown as GurpsCharacterSheet;
       delete (missingAttributes as { attributes?: unknown }).attributes;
       expect(isPF2Character(missingAbilities)).toBe(false);
       expect(isGurpsCharacter(missingAttributes)).toBe(false);
     });
   });

   describe('getGridType', () => {
     it('returns hex for GURPS ruleset', () => {
       expect(getGridType('gurps')).toBe('hex');
     });

     it('returns square for PF2 ruleset', () => {
       expect(getGridType('pf2')).toBe('square');
     });
   });
});
