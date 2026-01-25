import type { PF2CharacterSheet } from '../../shared/rulesets/pf2/characterSheet'
import type { Abilities } from '../../shared/rulesets/pf2/types'
import { uuid } from '../utils/uuid'

type PF2TemplateInput = {
  name: string;
  level: number;
  classHP: number;
  abilities: Abilities;
  skills: { name: string; ability: keyof Abilities; level: number }[];
  equipment: {
    name: string;
    damage: string;
    damageType: 'crushing' | 'cutting' | 'impaling';
    reach: 'C' | '1' | '2' | 'C,1' | '1,2';
    parry: number;
  }[];
  advantages: { name: string; description?: string }[];
  disadvantages: { name: string; description?: string }[];
};

const calculatePF2DerivedStats = (
  abilities: Abilities,
  level: number,
  classHP: number
) => {
  const conMod = Math.floor((abilities.constitution - 10) / 2);
  const dexMod = Math.floor((abilities.dexterity - 10) / 2);
  const hitPoints = classHP + (conMod * level) + (abilities.constitution - 10);
  const trainedBonus = 2;
  const speed = 25;
  
  return {
    hitPoints: Math.max(1, hitPoints),
    armorClass: 10 + dexMod + trainedBonus,
    fortitudeSave: Math.floor((abilities.constitution - 10) / 2) + trainedBonus,
    reflexSave: dexMod + trainedBonus,
    willSave: Math.floor((abilities.wisdom - 10) / 2) + trainedBonus,
    perception: Math.floor((abilities.wisdom - 10) / 2) + trainedBonus,
    speed,
  };
};

const createPF2Template = (input: PF2TemplateInput): Omit<PF2CharacterSheet, 'id'> => ({
  name: input.name,
  level: input.level,
  class: 'Fighter',
  ancestry: 'Human',
  heritage: 'Human',
  background: 'Soldier',
  abilities: input.abilities,
  derived: calculatePF2DerivedStats(input.abilities, input.level, input.classHP),
  classHP: input.classHP,
  saveProficiencies: {
    fortitude: 'trained',
    reflex: 'trained',
    will: 'trained',
  },
  perceptionProficiency: 'trained',
  armorProficiency: 'trained',
  skills: input.skills.map(s => ({ id: uuid(), name: s.name, ability: s.ability, proficiency: 'trained' })),
  weapons: input.equipment.map(e => ({ id: uuid(), name: e.name, damage: e.damage, damageType: e.damageType as any, proficiencyCategory: 'simple', traits: [], potencyRune: 0, strikingRune: null })),
  armor: null,
  feats: input.advantages.map(a => ({ id: uuid(), name: a.name, type: 'class', level: 1, description: a.description })),
  spells: null,
});

export const PF2_CHARACTER_TEMPLATES: Record<string, Omit<PF2CharacterSheet, 'id'>> = {
   fighter: createPF2Template({
     name: 'Valeros',
     level: 1,
     classHP: 10,
     abilities: { strength: 18, dexterity: 14, constitution: 14, intelligence: 10, wisdom: 12, charisma: 10 },
     skills: [
       { name: 'Athletics', ability: 'strength', level: 7 },
       { name: 'Intimidation', ability: 'charisma', level: 5 },
     ],
    equipment: [
      { name: 'Longsword', damage: '1d8', damageType: 'cutting', reach: '1', parry: 0 },
      { name: 'Steel Shield', damage: '1d4', damageType: 'crushing', reach: 'C', parry: 2 },
    ],
    advantages: [
      { name: 'Attack of Opportunity', description: 'Reaction strike when enemy leaves reach' },
      { name: 'Shield Block', description: 'Reduce damage with shield' },
    ],
    disadvantages: [],
  }),

   rogue: createPF2Template({
     name: 'Merisiel',
     level: 1,
     classHP: 8,
     abilities: { strength: 12, dexterity: 18, constitution: 12, intelligence: 14, wisdom: 10, charisma: 14 },
     skills: [
       { name: 'Stealth', ability: 'dexterity', level: 7 },
       { name: 'Thievery', ability: 'dexterity', level: 7 },
       { name: 'Acrobatics', ability: 'dexterity', level: 7 },
     ],
    equipment: [
      { name: 'Rapier', damage: '1d6', damageType: 'impaling', reach: '1', parry: 0 },
      { name: 'Shortsword', damage: '1d6', damageType: 'impaling', reach: 'C,1', parry: 0 },
    ],
    advantages: [
      { name: 'Sneak Attack', description: '+1d6 damage to flat-footed targets' },
      { name: 'Surprise Attack', description: 'Enemies flat-footed on first round' },
    ],
    disadvantages: [],
  }),

   cleric: createPF2Template({
     name: 'Kyra',
     level: 1,
     classHP: 8,
     abilities: { strength: 14, dexterity: 10, constitution: 12, intelligence: 10, wisdom: 18, charisma: 14 },
     skills: [
       { name: 'Religion', ability: 'intelligence', level: 7 },
       { name: 'Medicine', ability: 'wisdom', level: 7 },
     ],
    equipment: [
      { name: 'Scimitar', damage: '1d6', damageType: 'cutting', reach: '1', parry: 0 },
    ],
    advantages: [
      { name: 'Divine Font', description: 'Heal or harm with divine energy' },
      { name: 'Domain: Sun', description: 'Fire and light powers' },
    ],
    disadvantages: [
      { name: 'Anathema', description: 'Must follow deity codes' },
    ],
  }),

   wizard: createPF2Template({
     name: 'Ezren',
     level: 1,
     classHP: 6,
     abilities: { strength: 10, dexterity: 14, constitution: 12, intelligence: 18, wisdom: 12, charisma: 10 },
     skills: [
       { name: 'Arcana', ability: 'intelligence', level: 7 },
       { name: 'Occultism', ability: 'intelligence', level: 5 },
     ],
    equipment: [
      { name: 'Staff', damage: '1d4', damageType: 'crushing', reach: '1', parry: 0 },
    ],
    advantages: [
      { name: 'Arcane School', description: 'Evocation specialist' },
      { name: 'Arcane Bond', description: 'Free spell per day' },
    ],
    disadvantages: [],
  }),

   barbarian: createPF2Template({
     name: 'Amiri',
     level: 1,
     classHP: 12,
     abilities: { strength: 18, dexterity: 12, constitution: 16, intelligence: 10, wisdom: 12, charisma: 10 },
     skills: [
       { name: 'Athletics', ability: 'strength', level: 7 },
       { name: 'Survival', ability: 'wisdom', level: 5 },
     ],
    equipment: [
      { name: 'Greataxe', damage: '1d12', damageType: 'cutting', reach: '1', parry: -2 },
    ],
    advantages: [
      { name: 'Rage', description: '+2 damage, +10 temp HP, -1 AC' },
      { name: 'Instinct: Giant', description: 'Reach when raging' },
    ],
    disadvantages: [
      { name: 'Fatigued after Rage', description: 'Fatigued for 1 round after rage ends' },
    ],
  }),

   monk: createPF2Template({
     name: 'Sajan',
     level: 1,
     classHP: 10,
     abilities: { strength: 12, dexterity: 18, constitution: 12, intelligence: 10, wisdom: 16, charisma: 10 },
     skills: [
       { name: 'Acrobatics', ability: 'dexterity', level: 7 },
       { name: 'Athletics', ability: 'strength', level: 5 },
     ],
    equipment: [
      { name: 'Fist', damage: '1d6', damageType: 'crushing', reach: 'C', parry: 0 },
    ],
    advantages: [
      { name: 'Flurry of Blows', description: 'Two Strikes with one action' },
      { name: 'Powerful Fist', description: 'd6 unarmed damage' },
    ],
    disadvantages: [],
  }),
};

export const PF2_TEMPLATE_NAMES = Object.keys(PF2_CHARACTER_TEMPLATES);
