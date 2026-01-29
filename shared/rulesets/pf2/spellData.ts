import type { SpellDefinition } from './types';

export const SPELL_DATABASE: Record<string, SpellDefinition> = {
  'Electric Arc': {
    name: 'Electric Arc',
    level: 0,
    tradition: 'arcane',
    castActions: 2,
    targetType: 'single',
    save: 'reflex',
    damageFormula: '1d4+{mod}',
    damageType: 'electricity',
  },
  'Magic Missile': {
    name: 'Magic Missile',
    level: 1,
    tradition: 'arcane',
    castActions: 2,
    targetType: 'single',
    damageFormula: '1d4+1',
    damageType: 'force',
  },
  'Fireball': {
    name: 'Fireball',
    level: 3,
    tradition: 'arcane',
    castActions: 2,
    targetType: 'area',
    save: 'reflex',
    damageFormula: '6d6',
    damageType: 'fire',
  },
  'Heal': {
    name: 'Heal',
    level: 1,
    tradition: 'divine',
    castActions: 2,
    targetType: 'single',
    healFormula: '1d8',
  },
  'Soothe': {
    name: 'Soothe',
    level: 1,
    tradition: 'occult',
    castActions: 2,
    targetType: 'single',
    healFormula: '1d10+4',
  },
  'Fear': {
    name: 'Fear',
    level: 1,
    tradition: 'arcane',
    castActions: 2,
    targetType: 'single',
    save: 'will',
    conditions: [{ condition: 'frightened', value: 1 }],
    duration: 'varies',
  },
  'Bless': {
    name: 'Bless',
    level: 1,
    tradition: 'divine',
    castActions: 2,
    targetType: 'area',
    duration: '1 minute',
  },
  'Ray of Frost': {
    name: 'Ray of Frost',
    level: 0,
    tradition: 'arcane',
    castActions: 2,
    targetType: 'single',
    damageFormula: '1d4+{mod}',
    damageType: 'cold',
  },
};

export const getSpell = (name: string): SpellDefinition | undefined => {
  return SPELL_DATABASE[name];
};
