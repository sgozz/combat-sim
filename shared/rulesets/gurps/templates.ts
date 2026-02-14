import type { GurpsCharacterSheet } from './characterSheet';
import type { TemplateEntry } from '../templates';
import { calculateDerivedStats } from './rules';
import { generateUUID as uuid } from '../../utils/uuid';

type HitLocation = 'eye' | 'skull' | 'face' | 'neck' | 'torso' | 'vitals' | 'groin' | 'arm_right' | 'arm_left' | 'hand_right' | 'hand_left' | 'leg_right' | 'leg_left' | 'foot_right' | 'foot_left';

const createTemplate = (
  name: string,
  attributes: { strength: number; dexterity: number; intelligence: number; health: number },
  skills: { name: string; level: number }[],
  equipment: { name: string; damage: string; damageType: 'crushing' | 'cutting' | 'impaling'; reach: 'C' | '1' | '2' | 'C,1' | '1,2'; parry: number }[],
  armor: { name: string; dr: number; coveredLocations: HitLocation[] }[],
  advantages: { name: string; description?: string }[],
  disadvantages: { name: string; description?: string }[],
  modelId?: string
): Omit<GurpsCharacterSheet, 'id'> => ({
  name,
  rulesetId: 'gurps',
  attributes,
  derived: calculateDerivedStats(attributes),
  skills: skills.map(s => ({ id: uuid(), ...s })),
  equipment: [
    ...equipment.map(e => ({ id: uuid(), type: 'melee' as const, ...e })),
    ...armor.map(a => ({ id: uuid(), type: 'armor' as const, ...a })),
  ],
  advantages: advantages.map(a => ({ id: uuid(), ...a })),
  disadvantages: disadvantages.map(d => ({ id: uuid(), ...d })),
  pointsTotal: 100,
  modelId,
});

// ─── Heroes ───

const knight = createTemplate(
  'Sir Aldric',
  { strength: 13, dexterity: 12, intelligence: 10, health: 12 },
  [
    { name: 'Broadsword', level: 14 },
    { name: 'Shield', level: 12 },
  ],
  [
    { name: 'Broadsword', damage: '2d', damageType: 'cutting', reach: '1', parry: 0 },
    { name: 'Medium Shield', damage: '1d', damageType: 'crushing', reach: '1', parry: 2 },
  ],
  [
    { name: 'Chain Mail', dr: 4, coveredLocations: ['torso', 'vitals', 'groin', 'arm_right', 'arm_left', 'leg_right', 'leg_left'] },
  ],
  [
    { name: 'Combat Reflexes', description: '+1 to active defenses' },
    { name: 'High Pain Threshold', description: 'No shock penalties' },
  ],
  [
    { name: 'Code of Honor', description: "Knight's code" },
    { name: 'Sense of Duty', description: 'Kingdom' },
  ],
  'warrior'
);

const swashbuckler = createTemplate(
  'Dante Vega',
  { strength: 11, dexterity: 14, intelligence: 11, health: 11 },
  [
    { name: 'Rapier', level: 16 },
    { name: 'Main-Gauche', level: 14 },
  ],
  [
    { name: 'Rapier', damage: '1d+1', damageType: 'impaling', reach: '1', parry: 0 },
    { name: 'Main-Gauche', damage: '1d-1', damageType: 'impaling', reach: 'C', parry: 0 },
  ],
  [],
  [
    { name: 'Combat Reflexes', description: '+1 to active defenses' },
    { name: 'Enhanced Parry', description: '+1 to Rapier parry' },
  ],
  [
    { name: 'Overconfidence', description: 'Believes in own skill' },
    { name: 'Compulsive Carousing', description: 'Loves parties' },
  ],
  'rogue'
);

const barbarian = createTemplate(
  'Grok the Mighty',
  { strength: 15, dexterity: 11, intelligence: 9, health: 13 },
  [
    { name: 'Two-Handed Axe', level: 13 },
    { name: 'Brawling', level: 12 },
  ],
  [
    { name: 'Great Axe', damage: '3d+1', damageType: 'cutting', reach: '1,2', parry: -2 },
  ],
  [
    { name: 'Leather Armor', dr: 2, coveredLocations: ['torso', 'vitals', 'groin', 'arm_right', 'arm_left'] },
  ],
  [
    { name: 'High Pain Threshold', description: 'No shock penalties' },
    { name: 'Hard to Kill', description: '+2 to HT rolls to stay alive' },
  ],
  [
    { name: 'Bad Temper', description: 'Quick to anger' },
    { name: 'Illiteracy', description: 'Cannot read or write' },
  ],
  'monk'
);

const duelist = createTemplate(
  'Lady Celeste',
  { strength: 10, dexterity: 15, intelligence: 12, health: 10 },
  [
    { name: 'Smallsword', level: 17 },
    { name: 'Fast-Draw (Sword)', level: 15 },
  ],
  [
    { name: 'Smallsword', damage: '1d', damageType: 'impaling', reach: '1', parry: 0 },
  ],
  [],
  [
    { name: 'Combat Reflexes', description: '+1 to active defenses' },
    { name: 'Weapon Master', description: '+2 damage with swords' },
  ],
  [
    { name: 'Sense of Duty', description: 'Family honor' },
    { name: 'Proud', description: 'Cannot accept insults' },
  ],
  'rogue'
);

const guardsman = createTemplate(
  'Marcus the Guard',
  { strength: 12, dexterity: 11, intelligence: 10, health: 12 },
  [
    { name: 'Spear', level: 13 },
    { name: 'Shield', level: 12 },
  ],
  [
    { name: 'Spear', damage: '1d+2', damageType: 'impaling', reach: '1,2', parry: 0 },
    { name: 'Large Shield', damage: '1d+1', damageType: 'crushing', reach: '1', parry: 3 },
  ],
  [],
  [
    { name: 'Fit', description: '+1 to HT rolls' },
  ],
  [
    { name: 'Duty', description: 'City watch' },
    { name: 'Sense of Duty', description: 'Protect citizens' },
  ],
  'warrior'
);

const thug = createTemplate(
  'Bruno',
  { strength: 13, dexterity: 10, intelligence: 9, health: 12 },
  [
    { name: 'Brawling', level: 12 },
    { name: 'Knife', level: 11 },
  ],
  [
    { name: 'Large Knife', damage: '1d', damageType: 'cutting', reach: 'C,1', parry: -1 },
    { name: 'Brass Knuckles', damage: '1d', damageType: 'crushing', reach: 'C', parry: 0 },
  ],
  [],
  [
    { name: 'High Pain Threshold', description: 'No shock penalties' },
  ],
  [
    { name: 'Bad Temper', description: 'Quick to anger' },
    { name: 'Bully', description: 'Picks on weaker targets' },
  ],
  'rogue'
);

// ─── Monsters ───

const goblin = createTemplate(
  'Goblin',
  { strength: 8, dexterity: 11, intelligence: 8, health: 10 },
  [
    { name: 'Knife', level: 12 },
    { name: 'Brawling', level: 11 },
  ],
  [
    { name: 'Large Knife', damage: '1d-2', damageType: 'cutting', reach: 'C,1', parry: -1 },
  ],
  [
    { name: 'Leather Scraps', dr: 1, coveredLocations: ['torso'] },
  ],
  [
    { name: 'Night Vision', description: 'Can see in the dark' },
  ],
  [
    { name: 'Cowardice', description: 'Flees when outmatched' },
    { name: 'Social Stigma', description: 'Monster' },
  ],
);

const orc_warrior = createTemplate(
  'Orc Warrior',
  { strength: 13, dexterity: 10, intelligence: 9, health: 11 },
  [
    { name: 'Broadsword', level: 12 },
    { name: 'Shield', level: 11 },
  ],
  [
    { name: 'Broadsword', damage: '2d', damageType: 'cutting', reach: '1', parry: 0 },
    { name: 'Medium Shield', damage: '1d', damageType: 'crushing', reach: '1', parry: 2 },
  ],
  [
    { name: 'Scale Mail', dr: 3, coveredLocations: ['torso', 'vitals', 'groin', 'arm_right', 'arm_left', 'leg_right', 'leg_left'] },
  ],
  [
    { name: 'High Pain Threshold', description: 'No shock penalties' },
  ],
  [
    { name: 'Bad Temper', description: 'Quick to anger' },
    { name: 'Bloodlust', description: 'Fights to the death' },
  ],
);

const skeleton = createTemplate(
  'Skeleton',
  { strength: 10, dexterity: 12, intelligence: 8, health: 10 },
  [
    { name: 'Shortsword', level: 13 },
  ],
  [
    { name: 'Shortsword', damage: '1d', damageType: 'cutting', reach: '1', parry: 0 },
  ],
  [],
  [
    { name: 'Unliving', description: 'No vitals, immune to metabolic hazards' },
    { name: 'High Pain Threshold', description: 'No shock penalties' },
    { name: 'Unfazeable', description: 'Cannot be stunned or frightened' },
  ],
  [
    { name: 'Cannot Speak', description: 'Undead, no voice' },
    { name: 'Fragile (Brittle)', description: 'Destroyed at -HP' },
  ],
);

const dire_wolf = createTemplate(
  'Dire Wolf',
  { strength: 12, dexterity: 12, intelligence: 4, health: 11 },
  [
    { name: 'Brawling', level: 13 },
  ],
  [
    { name: 'Bite', damage: '1d+1', damageType: 'cutting', reach: 'C', parry: 0 },
  ],
  [
    { name: 'Tough Hide', dr: 1, coveredLocations: ['torso', 'vitals', 'groin', 'neck', 'leg_right', 'leg_left'] },
  ],
  [
    { name: 'Quadruped', description: 'Four-legged, extra move' },
    { name: 'Combat Reflexes', description: '+1 to active defenses' },
  ],
  [
    { name: 'Cannot Speak', description: 'Animal intelligence' },
    { name: 'Wild Animal', description: 'Untamed predator' },
  ],
);

const bandit_monster = createTemplate(
  'Bandit',
  { strength: 11, dexterity: 11, intelligence: 10, health: 10 },
  [
    { name: 'Shortsword', level: 12 },
    { name: 'Bow', level: 11 },
  ],
  [
    { name: 'Shortsword', damage: '1d', damageType: 'cutting', reach: '1', parry: 0 },
  ],
  [
    { name: 'Leather Armor', dr: 2, coveredLocations: ['torso', 'vitals', 'groin', 'arm_right', 'arm_left'] },
  ],
  [],
  [
    { name: 'Greed', description: 'Motivated by treasure' },
  ],
  'rogue'
);

// ─── Exports ───

export const GURPS_TEMPLATES: TemplateEntry<GurpsCharacterSheet>[] = [
  // Heroes
  { id: 'knight', label: 'Sir Aldric', category: 'hero', data: knight },
  { id: 'swashbuckler', label: 'Dante Vega', category: 'hero', data: swashbuckler },
  { id: 'barbarian', label: 'Grok the Mighty', category: 'hero', data: barbarian },
  { id: 'duelist', label: 'Lady Celeste', category: 'hero', data: duelist },
  { id: 'guardsman', label: 'Marcus the Guard', category: 'hero', data: guardsman },
  { id: 'thug', label: 'Bruno', category: 'hero', data: thug },
  // Monsters
  { id: 'goblin', label: 'Goblin', category: 'monster', data: goblin },
  { id: 'orc_warrior', label: 'Orc Warrior', category: 'monster', data: orc_warrior },
  { id: 'skeleton', label: 'Skeleton', category: 'monster', data: skeleton },
  { id: 'dire_wolf', label: 'Dire Wolf', category: 'monster', data: dire_wolf },
  { id: 'bandit', label: 'Bandit', category: 'monster', data: bandit_monster },
];
