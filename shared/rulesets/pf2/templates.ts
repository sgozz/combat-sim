import type { PF2CharacterSheet } from './characterSheet';
import type { Abilities, PF2DamageType } from './types';
import type { TemplateEntry } from '../templates';
import { generateUUID as uuid } from '../../utils/uuid';

type PF2TemplateInput = {
  name: string;
  level: number;
  classHP: number;
  abilities: Abilities;
  modelId?: string;
  className?: string;
  ancestry?: string;
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
  rulesetId: 'pf2',
  level: input.level,
  class: input.className ?? 'Fighter',
  ancestry: input.ancestry ?? 'Human',
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
  weapons: input.equipment.map(e => ({
    id: uuid(),
    name: e.name,
    damage: e.damage,
    damageType: e.damageType as unknown as PF2DamageType,
    proficiencyCategory: 'simple',
    traits: [],
    potencyRune: 0,
    strikingRune: null,
  })),
  armor: null,
  shieldBonus: 0,
  shieldHardness: 0,
  feats: input.advantages.map(a => ({ id: uuid(), name: a.name, type: 'class', level: 1, description: a.description })),
  spells: null,
  spellcasters: [],
  modelId: input.modelId,
});

const fighter = createPF2Template({
  name: 'Valeros',
  level: 1,
  classHP: 10,
  abilities: { strength: 18, dexterity: 14, constitution: 14, intelligence: 10, wisdom: 12, charisma: 10 },
  modelId: 'warrior',
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
});

const rogue = createPF2Template({
  name: 'Merisiel',
  level: 1,
  classHP: 8,
  abilities: { strength: 12, dexterity: 18, constitution: 12, intelligence: 14, wisdom: 10, charisma: 14 },
  modelId: 'rogue',
  className: 'Rogue',
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
});

const cleric = createPF2Template({
  name: 'Kyra',
  level: 1,
  classHP: 8,
  abilities: { strength: 14, dexterity: 10, constitution: 12, intelligence: 10, wisdom: 18, charisma: 14 },
  modelId: 'cleric',
  className: 'Cleric',
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
});

const wizard = createPF2Template({
  name: 'Ezren',
  level: 1,
  classHP: 6,
  abilities: { strength: 10, dexterity: 14, constitution: 12, intelligence: 18, wisdom: 12, charisma: 10 },
  modelId: 'wizard',
  className: 'Wizard',
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
});

const pf2barbarian = createPF2Template({
  name: 'Amiri',
  level: 1,
  classHP: 12,
  abilities: { strength: 18, dexterity: 12, constitution: 16, intelligence: 10, wisdom: 12, charisma: 10 },
  modelId: 'monk',
  className: 'Barbarian',
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
});

const monk = createPF2Template({
  name: 'Sajan',
  level: 1,
  classHP: 10,
  abilities: { strength: 12, dexterity: 18, constitution: 12, intelligence: 10, wisdom: 16, charisma: 10 },
  modelId: 'monk',
  className: 'Monk',
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
});

const goblin_warrior = createPF2Template({
  name: 'Goblin Warrior',
  level: 1,
  classHP: 6,
  abilities: { strength: 12, dexterity: 16, constitution: 10, intelligence: 8, wisdom: 10, charisma: 8 },
  className: 'Warrior',
  ancestry: 'Goblin',
  skills: [
    { name: 'Stealth', ability: 'dexterity', level: 5 },
    { name: 'Acrobatics', ability: 'dexterity', level: 5 },
  ],
  equipment: [
    { name: 'Dogslicer', damage: '1d6', damageType: 'cutting', reach: '1', parry: 0 },
  ],
  advantages: [
    { name: 'Goblin Scuttle', description: 'Step as reaction when ally moves adjacent' },
  ],
  disadvantages: [],
});

const skeleton_guard = createPF2Template({
  name: 'Skeleton Guard',
  level: 1,
  classHP: 6,
  abilities: { strength: 14, dexterity: 12, constitution: 10, intelligence: 8, wisdom: 10, charisma: 8 },
  className: 'Undead',
  ancestry: 'Skeleton',
  skills: [
    { name: 'Athletics', ability: 'strength', level: 5 },
  ],
  equipment: [
    { name: 'Scimitar', damage: '1d6', damageType: 'cutting', reach: '1', parry: 0 },
  ],
  advantages: [
    { name: 'Undead Resilience', description: 'Immune to death effects, poison, disease' },
  ],
  disadvantages: [],
});

const wolf = createPF2Template({
  name: 'Wolf',
  level: 1,
  classHP: 8,
  abilities: { strength: 14, dexterity: 14, constitution: 12, intelligence: 4, wisdom: 12, charisma: 6 },
  className: 'Animal',
  ancestry: 'Wolf',
  skills: [
    { name: 'Athletics', ability: 'strength', level: 5 },
    { name: 'Stealth', ability: 'dexterity', level: 5 },
  ],
  equipment: [
    { name: 'Jaws', damage: '1d6', damageType: 'impaling', reach: 'C', parry: 0 },
  ],
  advantages: [
    { name: 'Pack Attack', description: '+1 attack when flanking' },
    { name: 'Knockdown', description: 'Trip on critical hit' },
  ],
  disadvantages: [],
});

const kobold_scout = createPF2Template({
  name: 'Kobold Scout',
  level: 1,
  classHP: 6,
  abilities: { strength: 8, dexterity: 16, constitution: 10, intelligence: 12, wisdom: 10, charisma: 10 },
  className: 'Rogue',
  ancestry: 'Kobold',
  skills: [
    { name: 'Stealth', ability: 'dexterity', level: 7 },
    { name: 'Crafting', ability: 'intelligence', level: 5 },
  ],
  equipment: [
    { name: 'Spear', damage: '1d6', damageType: 'impaling', reach: '1', parry: 0 },
  ],
  advantages: [
    { name: 'Sneak Attack', description: '+1d6 damage to flat-footed targets' },
  ],
  disadvantages: [],
});

const pf2bandit = createPF2Template({
  name: 'Bandit',
  level: 1,
  classHP: 10,
  abilities: { strength: 14, dexterity: 12, constitution: 12, intelligence: 10, wisdom: 10, charisma: 10 },
  modelId: 'rogue',
  skills: [
    { name: 'Intimidation', ability: 'charisma', level: 5 },
    { name: 'Athletics', ability: 'strength', level: 5 },
  ],
  equipment: [
    { name: 'Shortsword', damage: '1d6', damageType: 'impaling', reach: '1', parry: 0 },
  ],
  advantages: [
    { name: 'Attack of Opportunity', description: 'Reaction strike when enemy leaves reach' },
  ],
  disadvantages: [],
});

export const PF2_TEMPLATES: TemplateEntry<PF2CharacterSheet>[] = [
  { id: 'fighter', label: 'Valeros', category: 'hero', data: fighter },
  { id: 'rogue', label: 'Merisiel', category: 'hero', data: rogue },
  { id: 'cleric', label: 'Kyra', category: 'hero', data: cleric },
  { id: 'wizard', label: 'Ezren', category: 'hero', data: wizard },
  { id: 'barbarian', label: 'Amiri', category: 'hero', data: pf2barbarian },
  { id: 'monk', label: 'Sajan', category: 'hero', data: monk },
  { id: 'goblin_warrior', label: 'Goblin Warrior', category: 'monster', data: goblin_warrior },
  { id: 'skeleton_guard', label: 'Skeleton Guard', category: 'monster', data: skeleton_guard },
  { id: 'wolf', label: 'Wolf', category: 'monster', data: wolf },
  { id: 'kobold_scout', label: 'Kobold Scout', category: 'monster', data: kobold_scout },
  { id: 'bandit', label: 'Bandit', category: 'monster', data: pf2bandit },
];
