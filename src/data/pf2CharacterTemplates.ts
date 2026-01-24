import type { CharacterSheet } from '../../shared/types'
import { uuid } from '../utils/uuid'

type PF2TemplateInput = {
  name: string;
  level: number;
  classHP: number;
  abilities: {
    strength: number;
    dexterity: number;
    constitution: number;
    intelligence: number;
    wisdom: number;
    charisma: number;
  };
  skills: { name: string; level: number }[];
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
  abilities: PF2TemplateInput['abilities'],
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
    fatiguePoints: Math.max(1, hitPoints),
    basicSpeed: (abilities.dexterity + abilities.constitution) / 4,
    basicMove: Math.floor(speed / 5),
    dodge: 10 + dexMod + level + trainedBonus,
  };
};

const attributesFromPF2 = (pf2: PF2TemplateInput['abilities']) => ({
  strength: pf2.strength,
  dexterity: pf2.dexterity,
  intelligence: pf2.intelligence,
  health: pf2.constitution,
  wisdom: pf2.wisdom,
  charisma: pf2.charisma,
});

const createPF2Template = (input: PF2TemplateInput): Omit<CharacterSheet, 'id'> => ({
  name: input.name,
  attributes: attributesFromPF2(input.abilities),
  derived: calculatePF2DerivedStats(input.abilities, input.level, input.classHP),
  skills: input.skills.map(s => ({ id: uuid(), ...s })),
  equipment: input.equipment.map(e => ({ id: uuid(), type: 'melee' as const, ...e })),
  advantages: input.advantages.map(a => ({ id: uuid(), ...a })),
  disadvantages: input.disadvantages.map(d => ({ id: uuid(), ...d })),
  pointsTotal: input.level * 1000,
});

export const PF2_CHARACTER_TEMPLATES: Record<string, Omit<CharacterSheet, 'id'>> = {
  fighter: createPF2Template({
    name: 'Valeros',
    level: 1,
    classHP: 10,
    abilities: { strength: 18, dexterity: 14, constitution: 14, intelligence: 10, wisdom: 12, charisma: 10 },
    skills: [
      { name: 'Athletics', level: 7 },
      { name: 'Intimidation', level: 5 },
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
      { name: 'Stealth', level: 7 },
      { name: 'Thievery', level: 7 },
      { name: 'Acrobatics', level: 7 },
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
      { name: 'Religion', level: 7 },
      { name: 'Medicine', level: 7 },
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
      { name: 'Arcana', level: 7 },
      { name: 'Occultism', level: 5 },
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
      { name: 'Athletics', level: 7 },
      { name: 'Survival', level: 5 },
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
      { name: 'Acrobatics', level: 7 },
      { name: 'Athletics', level: 5 },
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
