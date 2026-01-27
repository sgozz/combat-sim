import type { CharacterSheet } from '../../shared/types'
import type { GurpsCharacterSheet } from '../../shared/rulesets/gurps/characterSheet'
import { calculateDerivedStats } from '../../shared/rulesets/gurps/rules'
import { uuid } from '../utils/uuid'

const createTemplate = (
  name: string,
  attributes: { strength: number; dexterity: number; intelligence: number; health: number },
  skills: { name: string; level: number }[],
  equipment: { name: string; damage: string; damageType: 'crushing' | 'cutting' | 'impaling'; reach: 'C' | '1' | '2' | 'C,1' | '1,2'; parry: number }[],
  advantages: { name: string; description?: string }[],
  disadvantages: { name: string; description?: string }[]
): Omit<GurpsCharacterSheet, 'id'> => ({
  name,
  rulesetId: 'gurps',
  attributes,
  derived: calculateDerivedStats(attributes),
  skills: skills.map(s => ({ id: uuid(), ...s })),
  equipment: equipment.map(e => ({ id: uuid(), type: 'melee' as const, ...e })),
  advantages: advantages.map(a => ({ id: uuid(), ...a })),
  disadvantages: disadvantages.map(d => ({ id: uuid(), ...d })),
  pointsTotal: 100,
})

export const CHARACTER_TEMPLATES: Record<string, Omit<GurpsCharacterSheet, 'id'>> = {
  knight: createTemplate(
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
      { name: 'Combat Reflexes', description: '+1 to active defenses' },
      { name: 'High Pain Threshold', description: 'No shock penalties' },
    ],
    [
      { name: 'Code of Honor', description: "Knight's code" },
      { name: 'Sense of Duty', description: 'Kingdom' },
    ]
  ),

  swashbuckler: createTemplate(
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
    [
      { name: 'Combat Reflexes', description: '+1 to active defenses' },
      { name: 'Enhanced Parry', description: '+1 to Rapier parry' },
    ],
    [
      { name: 'Overconfidence', description: 'Believes in own skill' },
      { name: 'Compulsive Carousing', description: 'Loves parties' },
    ]
  ),

  barbarian: createTemplate(
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
      { name: 'High Pain Threshold', description: 'No shock penalties' },
      { name: 'Hard to Kill', description: '+2 to HT rolls to stay alive' },
    ],
    [
      { name: 'Bad Temper', description: 'Quick to anger' },
      { name: 'Illiteracy', description: 'Cannot read or write' },
    ]
  ),

  duelist: createTemplate(
    'Lady Celeste',
    { strength: 10, dexterity: 15, intelligence: 12, health: 10 },
    [
      { name: 'Smallsword', level: 17 },
      { name: 'Fast-Draw (Sword)', level: 15 },
    ],
    [
      { name: 'Smallsword', damage: '1d', damageType: 'impaling', reach: '1', parry: 0 },
    ],
    [
      { name: 'Combat Reflexes', description: '+1 to active defenses' },
      { name: 'Weapon Master', description: '+2 damage with swords' },
    ],
    [
      { name: 'Sense of Duty', description: 'Family honor' },
      { name: 'Proud', description: 'Cannot accept insults' },
    ]
  ),

  guardsman: createTemplate(
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
    [
      { name: 'Fit', description: '+1 to HT rolls' },
    ],
    [
      { name: 'Duty', description: 'City watch' },
      { name: 'Sense of Duty', description: 'Protect citizens' },
    ]
  ),

  thug: createTemplate(
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
    [
      { name: 'High Pain Threshold', description: 'No shock penalties' },
    ],
    [
      { name: 'Bad Temper', description: 'Quick to anger' },
      { name: 'Bully', description: 'Picks on weaker targets' },
    ]
  ),
}

export { TEMPLATE_NAMES } from '../../shared/rulesets/gurps/templateNames'

import { PF2_CHARACTER_TEMPLATES, PF2_TEMPLATE_NAMES } from './pf2CharacterTemplates'
export { PF2_CHARACTER_TEMPLATES, PF2_TEMPLATE_NAMES }

import type { RulesetId } from '../../shared/types'

export const getTemplatesForRuleset = (rulesetId: RulesetId): Record<string, Omit<CharacterSheet, 'id'>> => {
  if (rulesetId === 'pf2') {
    return PF2_CHARACTER_TEMPLATES as Record<string, Omit<CharacterSheet, 'id'>>
  }
  return CHARACTER_TEMPLATES as Record<string, Omit<CharacterSheet, 'id'>>
}
