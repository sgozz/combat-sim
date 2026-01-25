import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mapPathbuilderToCharacter } from './pathbuilderMapping';
import type { PathbuilderExport } from './pathbuilder';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureData: PathbuilderExport = JSON.parse(
  readFileSync(join(__dirname, '__fixtures__/pathbuilder-163111.json'), 'utf-8')
);

describe('mapPathbuilderToCharacter', () => {
  it('maps basic character info correctly', () => {
    const result = mapPathbuilderToCharacter(fixtureData);
    
    expect(result.name).toBe('Jordo PF2e Champion Paladin');
    expect(result.level).toBe(1);
    expect(result.class).toBe('Champion');
    expect(result.ancestry).toBe('Human');
    expect(result.heritage).toBe('Nephilim');
    expect(result.background).toBe('Squire (Warfare)');
  });

  it('maps abilities correctly', () => {
    const result = mapPathbuilderToCharacter(fixtureData);
    
    expect(result.abilities.strength).toBe(16);
    expect(result.abilities.dexterity).toBe(10);
    expect(result.abilities.constitution).toBe(16);
    expect(result.abilities.intelligence).toBe(10);
    expect(result.abilities.wisdom).toBe(12);
    expect(result.abilities.charisma).toBe(14);
  });

  it('calculates derived stats correctly', () => {
    const result = mapPathbuilderToCharacter(fixtureData);
    
    expect(result.derived.hitPoints).toBe(21);
    expect(result.derived.armorClass).toBe(16);
    expect(result.derived.speed).toBe(25);
    expect(result.derived.perception).toBe(4);
    expect(result.derived.fortitudeSave).toBe(8);
    expect(result.derived.reflexSave).toBe(3);
    expect(result.derived.willSave).toBe(6);
  });

  it('maps weapons correctly', () => {
    const result = mapPathbuilderToCharacter(fixtureData);
    
    expect(result.weapons).toHaveLength(2);
    
    const dagger = result.weapons.find(w => w.name === 'Dagger');
    expect(dagger).toBeDefined();
    expect(dagger?.damage).toBe('1d4');
    expect(dagger?.damageType).toBe('piercing');
    expect(dagger?.proficiencyCategory).toBe('simple');
    expect(dagger?.potencyRune).toBe(0);
    expect(dagger?.strikingRune).toBe(null);
    expect(dagger?.traits).toEqual([]);
    
    const scythe = result.weapons.find(w => w.name === 'Scythe');
    expect(scythe).toBeDefined();
    expect(scythe?.damage).toBe('1d10');
    expect(scythe?.damageType).toBe('slashing');
    expect(scythe?.proficiencyCategory).toBe('martial');
  });

  it('maps armor correctly', () => {
    const result = mapPathbuilderToCharacter(fixtureData);
    
    expect(result.armor).toBeDefined();
    expect(result.armor?.name).toBe('Hide');
    expect(result.armor?.proficiencyCategory).toBe('medium');
    expect(result.armor?.acBonus).toBe(3);
    expect(result.armor?.dexCap).toBe(2);
    expect(result.armor?.potencyRune).toBe(0);
  });

  it('maps skills correctly', () => {
    const result = mapPathbuilderToCharacter(fixtureData);
    
    const athletics = result.skills.find(s => s.name === 'athletics');
    expect(athletics).toBeDefined();
    expect(athletics?.ability).toBe('strength');
    expect(athletics?.proficiency).toBe('trained');
    expect(athletics?.id).toBeDefined();
    
    const diplomacy = result.skills.find(s => s.name === 'diplomacy');
    expect(diplomacy).toBeDefined();
    expect(diplomacy?.ability).toBe('charisma');
    expect(diplomacy?.proficiency).toBe('trained');
    
    const warfare = result.skills.find(s => s.name === 'Lore: Warfare');
    expect(warfare).toBeDefined();
    expect(warfare?.ability).toBe('intelligence');
    expect(warfare?.proficiency).toBe('trained');
  });

  it('maps feats correctly', () => {
    const result = mapPathbuilderToCharacter(fixtureData);
    
    expect(result.feats.length).toBeGreaterThan(0);
    
    const shieldBlock = result.feats.find(f => f.name === 'Shield Block');
    expect(shieldBlock).toBeDefined();
    expect(shieldBlock?.type).toBe('Awarded Feat');
    expect(shieldBlock?.level).toBe(1);
    expect(shieldBlock?.id).toBeDefined();
  });

  it('maps spells correctly', () => {
    const result = mapPathbuilderToCharacter(fixtureData);
    
    expect(result.spells).toBeDefined();
    expect(result.spells?.tradition).toBe('divine');
    expect(result.spells?.proficiency).toBe('trained');
    expect(result.spells?.known).toContain('Lay on Hands');
  });

  it('maps proficiencies correctly', () => {
    const result = mapPathbuilderToCharacter(fixtureData);
    
    expect(result.saveProficiencies.fortitude).toBe('expert');
    expect(result.saveProficiencies.reflex).toBe('trained');
    expect(result.saveProficiencies.will).toBe('expert');
    expect(result.perceptionProficiency).toBe('trained');
    expect(result.armorProficiency).toBe('trained');
  });

  it('handles empty weapon traits array', () => {
    const result = mapPathbuilderToCharacter(fixtureData);
    
    result.weapons.forEach(weapon => {
      expect(Array.isArray(weapon.traits)).toBe(true);
      expect(weapon.traits).toEqual([]);
    });
  });

  it('falls back to Unarmored stats for unknown armor', () => {
    const modifiedData: PathbuilderExport = {
      ...fixtureData,
      build: {
        ...fixtureData.build,
        armor: [{
          name: 'Unknown Armor Type',
          qty: 1,
          prof: 'light',
          pot: 0,
          res: '',
          mat: null,
          display: 'Unknown Armor Type',
          worn: true,
          runes: [],
        }],
      },
    };
    
    const result = mapPathbuilderToCharacter(modifiedData);
    
    expect(result.armor).toBeDefined();
    expect(result.armor?.acBonus).toBe(0);
    expect(result.armor?.dexCap).toBe(null);
    expect(result.armor?.proficiencyCategory).toBe('unarmored');
  });

  it('generates unique IDs for all entities', () => {
    const result = mapPathbuilderToCharacter(fixtureData);
    
    expect(result.id).toBeDefined();
    expect(typeof result.id).toBe('string');
    
    result.weapons.forEach(weapon => {
      expect(weapon.id).toBeDefined();
      expect(typeof weapon.id).toBe('string');
    });
    
    result.skills.forEach(skill => {
      expect(skill.id).toBeDefined();
      expect(typeof skill.id).toBe('string');
    });
    
    result.feats.forEach(feat => {
      expect(feat.id).toBeDefined();
      expect(typeof feat.id).toBe('string');
    });
    
    if (result.armor) {
      expect(result.armor.id).toBeDefined();
      expect(typeof result.armor.id).toBe('string');
    }
  });
});
