import { describe, it, expect } from 'vitest';
import { pf2Ruleset } from './index';
import type { CharacterSheet } from '../../types';

describe('PF2 Ruleset - getDerivedStats', () => {
  it('should calculate AC correctly with Full Plate armor equipped', () => {
    // Character: Level 1, Dex 14 (+2), Full Plate (+6 AC, dexCap 0), Trained armor prof
    // Expected AC: 10 + 0 (dex capped) + 6 (armor) + 3 (trained prof at level 1) = 19
    const character: CharacterSheet = {
      id: 'test-1',
      name: 'Valeros',
      rulesetId: 'pf2',
      level: 1,
      class: 'Fighter',
      ancestry: 'Human',
      heritage: 'Versatile Heritage',
      background: 'Warrior',
      abilities: {
        strength: 18,
        dexterity: 14, // +2 modifier
        constitution: 14,
        intelligence: 10,
        wisdom: 10,
        charisma: 10,
      },
      derived: {
        hitPoints: 10,
        armorClass: 10, // This will be recalculated
        speed: 25,
        fortitudeSave: 0,
        reflexSave: 0,
        willSave: 0,
        perception: 0,
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
      armor: {
        name: 'Full Plate',
        acBonus: 6,
        dexCap: 0,
        checkPenalty: -3,
        speedPenalty: -5,
        strength: 16,
        bulk: 4,
        group: 'plate',
        traits: [],
      },
      shieldBonus: 0,
      shieldHardness: 0,
      feats: [],
      spells: null,
      spellcasters: [],
    };

    const derivedStats = pf2Ruleset.getDerivedStats(character);

    // AC should be 19, not 10
    expect(derivedStats.armorClass).toBe(19);
  });

  it('should calculate AC correctly with no armor equipped', () => {
    // Character: Level 1, Dex 14 (+2), No armor, Trained armor prof
    // Expected AC: 10 + 2 (dex) + 0 (no armor) + 3 (trained prof at level 1) = 15
    const character: CharacterSheet = {
      id: 'test-2',
      name: 'Monk',
      rulesetId: 'pf2',
      level: 1,
      class: 'Monk',
      ancestry: 'Human',
      heritage: 'Versatile Heritage',
      background: 'Warrior',
      abilities: {
        strength: 10,
        dexterity: 14, // +2 modifier
        constitution: 10,
        intelligence: 10,
        wisdom: 14,
        charisma: 10,
      },
      derived: {
        hitPoints: 10,
        armorClass: 10,
        speed: 25,
        fortitudeSave: 0,
        reflexSave: 0,
        willSave: 0,
        perception: 0,
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
      armor: null, // No armor
      shieldBonus: 0,
      shieldHardness: 0,
      feats: [],
      spells: null,
      spellcasters: [],
    };

    const derivedStats = pf2Ruleset.getDerivedStats(character);

    // AC should be 15
    expect(derivedStats.armorClass).toBe(15);
  });
});
