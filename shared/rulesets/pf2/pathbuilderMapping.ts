import type { PF2CharacterSheet, PF2CharacterWeapon, PF2CharacterArmor, PF2Feat, PF2SpellInfo } from './characterSheet';
import type { Abilities, Proficiency, PF2Skill } from './types';
import type { PathbuilderExport, PathbuilderBuild, PathbuilderWeapon, PathbuilderArmor, PathbuilderFeatTuple, PathbuilderLoreTuple } from './pathbuilder';
import { uuid } from '../../utils/uuid';

const getProfBonus = (rank: number, level: number): number => {
  if (rank === 0) return 0;
  return level + rank;
};

const mapAbilities = (build: PathbuilderBuild): Abilities => ({
  strength: build.abilities.str,
  dexterity: build.abilities.dex,
  constitution: build.abilities.con,
  intelligence: build.abilities.int,
  wisdom: build.abilities.wis,
  charisma: build.abilities.cha,
});

const mapProficiency = (rank: number): Proficiency => {
  if (rank === 0) return 'untrained';
  if (rank === 2) return 'trained';
  if (rank === 4) return 'expert';
  if (rank === 6) return 'master';
  return 'legendary';
};

const calculateDerivedStats = (build: PathbuilderBuild) => {
  const conMod = Math.floor((build.abilities.con - 10) / 2);
  const dexMod = Math.floor((build.abilities.dex - 10) / 2);
  const wisMod = Math.floor((build.abilities.wis - 10) / 2);

  return {
    hitPoints: build.attributes.ancestryhp + (build.level * (build.attributes.classhp + conMod)) 
               + build.attributes.bonushp + (build.level * build.attributes.bonushpPerLevel),
    armorClass: build.acTotal.acTotal,
    speed: build.attributes.speed + build.attributes.speedBonus,
    fortitudeSave: getProfBonus(build.proficiencies.fortitude ?? 0, build.level) + conMod,
    reflexSave: getProfBonus(build.proficiencies.reflex ?? 0, build.level) + dexMod,
    willSave: getProfBonus(build.proficiencies.will ?? 0, build.level) + wisMod,
    perception: getProfBonus(build.proficiencies.perception ?? 0, build.level) + wisMod,
  };
};

const mapDamageType = (char: string): 'bludgeoning' | 'piercing' | 'slashing' => {
  if (char === 'B') return 'bludgeoning';
  if (char === 'P') return 'piercing';
  return 'slashing';
};

const mapStrikingRune = (str: string): 'striking' | 'greater_striking' | 'major_striking' | null => {
  if (str === '') return null;
  if (str === 'striking') return 'striking';
  if (str === 'greaterStriking') return 'greater_striking';
  return 'major_striking';
};

const mapWeapon = (w: PathbuilderWeapon): PF2CharacterWeapon => ({
  id: uuid(),
  name: w.name,
  damage: `1${w.die}`,
  damageType: mapDamageType(w.damageType),
  proficiencyCategory: w.prof as 'simple' | 'martial' | 'advanced' | 'unarmed',
  traits: [],
  potencyRune: w.pot,
  strikingRune: mapStrikingRune(w.str),
});

const mapWeapons = (weapons: PathbuilderWeapon[]): PF2CharacterWeapon[] => {
  return weapons.map(mapWeapon);
};

const ARMOR_TABLE: Record<string, { acBonus: number; dexCap: number | null; category: string }> = {
  'Unarmored': { acBonus: 0, dexCap: null, category: 'unarmored' },
  'Padded Armor': { acBonus: 1, dexCap: 3, category: 'light' },
  'Leather Armor': { acBonus: 1, dexCap: 4, category: 'light' },
  'Studded Leather Armor': { acBonus: 2, dexCap: 3, category: 'light' },
  'Chain Shirt': { acBonus: 2, dexCap: 3, category: 'light' },
  'Hide Armor': { acBonus: 3, dexCap: 2, category: 'medium' },
  'Hide': { acBonus: 3, dexCap: 2, category: 'medium' },
  'Scale Mail': { acBonus: 3, dexCap: 2, category: 'medium' },
  'Chain Mail': { acBonus: 4, dexCap: 1, category: 'medium' },
  'Breastplate': { acBonus: 4, dexCap: 1, category: 'medium' },
  'Splint Mail': { acBonus: 5, dexCap: 1, category: 'heavy' },
  'Half Plate': { acBonus: 5, dexCap: 1, category: 'heavy' },
  'Full Plate': { acBonus: 6, dexCap: 0, category: 'heavy' },
};

const mapArmor = (armorArray: PathbuilderArmor[]): PF2CharacterArmor | null => {
  const wornArmor = armorArray.find(a => a.worn);
  if (!wornArmor) return null;
  
  const baseStats = ARMOR_TABLE[wornArmor.name] ?? ARMOR_TABLE['Unarmored'];
  
  return {
    id: uuid(),
    name: wornArmor.name,
    proficiencyCategory: baseStats.category as 'unarmored' | 'light' | 'medium' | 'heavy',
    acBonus: baseStats.acBonus + wornArmor.pot,
    dexCap: baseStats.dexCap,
    potencyRune: wornArmor.pot,
  };
};

const SKILL_ABILITY_MAP: Record<string, keyof Abilities> = {
  acrobatics: 'dexterity',
  arcana: 'intelligence',
  athletics: 'strength',
  crafting: 'intelligence',
  deception: 'charisma',
  diplomacy: 'charisma',
  intimidation: 'charisma',
  medicine: 'wisdom',
  nature: 'wisdom',
  occultism: 'intelligence',
  performance: 'charisma',
  religion: 'wisdom',
  society: 'intelligence',
  stealth: 'dexterity',
  survival: 'wisdom',
  thievery: 'dexterity',
};

const mapSkills = (proficiencies: Record<string, number | undefined>, lores: PathbuilderLoreTuple[]): PF2Skill[] => {
  const skills: PF2Skill[] = [];
  
  for (const [skillName, abilityKey] of Object.entries(SKILL_ABILITY_MAP)) {
    const rank = proficiencies[skillName] ?? 0;
    if (rank > 0) {
      skills.push({
        id: uuid(),
        name: skillName,
        ability: abilityKey,
        proficiency: mapProficiency(rank),
      });
    }
  }
  
  for (const [loreName, rank] of lores) {
    skills.push({
      id: uuid(),
      name: `Lore: ${loreName}`,
      ability: 'intelligence' as keyof Abilities,
      proficiency: mapProficiency(rank),
    });
  }
  
  return skills;
};

const mapFeat = (tuple: PathbuilderFeatTuple): PF2Feat => ({
  id: uuid(),
  name: tuple[0],
  type: tuple[2],
  level: tuple[3],
  description: tuple[1] ?? undefined,
});

const mapFeats = (feats: PathbuilderFeatTuple[]): PF2Feat[] => {
  return feats.map(mapFeat);
};

const mapSpells = (build: PathbuilderBuild): PF2SpellInfo | null => {
  const focusEntries = Object.entries(build.focus);
  if (focusEntries.length === 0 && build.spellCasters.length === 0) {
    return null;
  }

  const traditions = ['castingArcane', 'castingDivine', 'castingOccult', 'castingPrimal'] as const;
  let bestTradition: string = 'arcane';
  let bestProf = 0;
  for (const t of traditions) {
    const prof = build.proficiencies[t] ?? 0;
    if (prof > bestProf) {
      bestProf = prof;
      bestTradition = t.replace('casting', '').toLowerCase();
    }
  }

  const spellNames: string[] = [];
  for (const [, traditionData] of focusEntries) {
    for (const [, data] of Object.entries(traditionData)) {
      if (data.focusCantrips) spellNames.push(...data.focusCantrips);
      if (data.focusSpells) spellNames.push(...data.focusSpells);
    }
  }

  return {
    tradition: bestTradition,
    proficiency: mapProficiency(bestProf),
    known: spellNames,
  };
};

export const mapPathbuilderToCharacter = (data: PathbuilderExport): PF2CharacterSheet => {
  const build = data.build;
  const abilities = mapAbilities(build);
  
  return {
    id: uuid(),
    name: build.name,
    level: build.level,
    class: build.class,
    ancestry: build.ancestry,
    heritage: build.heritage ?? '',
    background: build.background ?? '',
    abilities,
    derived: calculateDerivedStats(build),
    classHP: build.attributes.classhp,
    saveProficiencies: {
      fortitude: mapProficiency(build.proficiencies.fortitude ?? 0),
      reflex: mapProficiency(build.proficiencies.reflex ?? 0),
      will: mapProficiency(build.proficiencies.will ?? 0),
    },
    perceptionProficiency: mapProficiency(build.proficiencies.perception ?? 0),
    armorProficiency: mapProficiency(build.proficiencies[build.armor.find(a => a.worn)?.prof ?? 'unarmored'] ?? 0),
    skills: mapSkills(build.proficiencies, build.lores),
    weapons: mapWeapons(build.weapons),
    armor: mapArmor(build.armor),
    feats: mapFeats(build.feats),
    spells: mapSpells(build),
  };
};
