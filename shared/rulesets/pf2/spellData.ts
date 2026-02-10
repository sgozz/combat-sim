import type { SpellDefinition } from './types';

export const SPELL_DATABASE: Record<string, SpellDefinition> = {
  'Electric Arc': {
    name: 'Electric Arc',
    level: 0,
    traditions: ['arcane', 'primal'],
    castActions: 2,
    targetType: 'single',
    save: 'reflex',
    damageFormula: '1d4+{mod}',
    damageType: 'electricity',
    range: '30 feet',
    traits: ['cantrip', 'concentrate', 'electricity', 'manipulate'],
    heighten: {
      type: 'interval',
      interval: 1,
      damagePerLevel: '+1d4',
    },
  },
  'Magic Missile': {
    name: 'Magic Missile',
    level: 1,
    traditions: ['arcane', 'occult'],
    castActions: 2,
    targetType: 'single',
    damageFormula: '1d4+1',
    damageType: 'force',
    range: '120 feet',
    traits: ['concentrate', 'force', 'manipulate'],
    heighten: {
      type: 'fixed',
      fixedLevels: {
        3: { damage: '+1' },
        5: { damage: '+1' },
        7: { damage: '+1' },
        9: { damage: '+1' },
      },
    },
  },
  'Fireball': {
    name: 'Fireball',
    level: 3,
    traditions: ['arcane', 'primal'],
    castActions: 2,
    targetType: 'area',
    save: 'reflex',
    damageFormula: '6d6',
    damageType: 'fire',
    range: '500 feet',
    traits: ['concentrate', 'fire', 'manipulate'],
    heighten: {
      type: 'interval',
      interval: 1,
      damagePerLevel: '+2d6',
    },
    areaShape: 'burst',
    areaSize: 4,
  },
  'Heal': {
    name: 'Heal',
    level: 1,
    traditions: ['divine', 'primal'],
    castActions: 2,
    targetType: 'single',
    healFormula: '1d8',
    range: '30 feet',
    traits: ['concentrate', 'healing', 'manipulate', 'positive'],
    heighten: {
      type: 'interval',
      interval: 1,
      damagePerLevel: '+1d8',
    },
  },
  'Soothe': {
    name: 'Soothe',
    level: 1,
    traditions: ['occult'],
    castActions: 2,
    targetType: 'single',
    healFormula: '1d10+4',
    range: '30 feet',
    traits: ['concentrate', 'healing', 'manipulate', 'mental'],
  },
  'Fear': {
    name: 'Fear',
    level: 1,
    traditions: ['arcane', 'divine', 'occult', 'primal'],
    castActions: 2,
    targetType: 'single',
    save: 'will',
    conditions: [{ condition: 'frightened', value: 1 }],
    duration: 'varies',
    range: '30 feet',
    traits: ['concentrate', 'emotion', 'fear', 'manipulate', 'mental'],
  },
  'Bless': {
    name: 'Bless',
    level: 1,
    traditions: ['divine', 'occult'],
    castActions: 2,
    targetType: 'area',
    duration: '1 minute',
    range: 'self',
    traits: ['concentrate', 'manipulate'],
    areaShape: 'emanation',
    areaSize: 1,
  },
  'Ray of Frost': {
    name: 'Ray of Frost',
    level: 0,
    traditions: ['arcane', 'primal'],
    castActions: 2,
    targetType: 'attack',
    damageFormula: '1d4+{mod}',
    damageType: 'cold',
    range: '120 feet',
    traits: ['attack', 'cantrip', 'cold', 'concentrate', 'manipulate'],
  },
};

export function enrichSpellDatabase(spells: Map<string, SpellDefinition>): number {
  let added = 0;
  for (const [name, spell] of spells) {
    if (!SPELL_DATABASE[name]) {
      SPELL_DATABASE[name] = spell;
      added++;
    }
  }
  return added;
}

export function getSpellCount(): number {
  return Object.keys(SPELL_DATABASE).length;
}

export const getSpell = (name: string): SpellDefinition | undefined => {
  return SPELL_DATABASE[name];
};

export const getHeightenedDamage = (spell: SpellDefinition, castLevel: number): string => {
  if (!spell.heighten) {
    return spell.damageFormula || spell.healFormula || '';
  }

  const baseFormula = spell.damageFormula || spell.healFormula || '';
  const baseLevel = spell.level;

  if (castLevel < baseLevel) {
    return baseFormula;
  }

  const heightenLevels = castLevel - baseLevel;

  if (heightenLevels === 0) {
    return baseFormula;
  }

  if (spell.heighten.type === 'interval' && spell.heighten.damagePerLevel) {
    const baseDice = baseFormula.match(/(\d+)d(\d+)/);
    if (!baseDice) return baseFormula;

    const baseDiceCount = parseInt(baseDice[1], 10);
    const diceSides = baseDice[2];
    const heightenDice = spell.heighten.damagePerLevel.match(/\+?(\d+)d(\d+)/);

    if (!heightenDice) return baseFormula;

    const heightenDiceCount = parseInt(heightenDice[1], 10);
    const totalDice = baseDiceCount + heightenDiceCount * heightenLevels;

    const modifier = baseFormula.match(/\+\{mod\}/) ? '+{mod}' : '';
    return `${totalDice}d${diceSides}${modifier}`;
  }

  if (spell.heighten.type === 'fixed' && spell.heighten.fixedLevels) {
    const baseDice = baseFormula.match(/(\d+)d(\d+)/);
    if (!baseDice) return baseFormula;

    const baseDiceCount = parseInt(baseDice[1], 10);
    const diceSides = baseDice[2];
    const baseModifier = baseFormula.match(/\+(\d+)/) ? parseInt(baseFormula.match(/\+(\d+)/)![1], 10) : 0;

    let totalHeighten = 0;
    for (const level of Object.keys(spell.heighten.fixedLevels).map(Number).sort((a, b) => a - b)) {
      if (level <= castLevel) {
        const entry = spell.heighten.fixedLevels[level];
        if (entry?.damage) {
          totalHeighten += parseInt(entry.damage.replace(/\D/g, ''), 10);
        }
      }
    }

    if (totalHeighten > 0) {
      const totalDice = baseDiceCount + totalHeighten;
      const totalModifier = baseModifier + totalHeighten;
      return `${totalDice}d${diceSides}+${totalModifier}`;
    }
  }

  return baseFormula;
};
