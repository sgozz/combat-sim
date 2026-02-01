import type { PF2Feat } from './characterSheet';

export interface Pf2oolsFeat {
  type: string;
  name: { display: string; specifier?: string };
  data: {
    level: number;
    traits: string[];
    actionCost?: { actions: number };
    prerequisites?: string[];
    description: string;
  };
  tags: { source: { title: string; page: number } };
}

export interface Pf2oolsSpell {
  type?: string;
  name: { display: string };
  data: {
    level: number;
    heightening?: {
      type: 'interval' | 'fixed';
      interval?: number;
      damage?: string;
      levels?: Record<number, { damage?: string }>;
    };
  };
}

export interface PF2FeatDefinition extends PF2Feat {
  actionCost?: number;
  traits: string[];
  prerequisites?: string[];
  source?: string;
}

export interface HeightenData {
  type: 'interval' | 'fixed';
  interval?: number;
  damagePerLevel?: string;
  fixedLevels?: Record<number, { damage?: string }>;
}

const TARGET_FEATS = new Set([
  'Attack of Opportunity',
  'Shield Block',
  'Power Attack',
  'Sudden Charge',
  'Reactive Shield',
  'Intimidating Strike',
  'Combat Grab',
  'Knockdown'
]);

export function parsePf2oolsFeat(raw: Pf2oolsFeat): PF2FeatDefinition {
  return {
    id: raw.name.display.toLowerCase().replace(/\s+/g, '_'),
    name: raw.name.display,
    type: raw.data.traits[0] || 'general',
    level: raw.data.level,
    description: raw.data.description,
    actionCost: raw.data.actionCost?.actions,
    traits: raw.data.traits,
    prerequisites: raw.data.prerequisites,
    source: raw.tags.source.title
  };
}

export function loadFeatsFromPf2ools(data: unknown[]): Map<string, PF2FeatDefinition> {
  const result = new Map<string, PF2FeatDefinition>();

  for (const item of data) {
    const feat = item as Pf2oolsFeat;

    if (feat.type !== 'feat') {
      continue;
    }

    if (!TARGET_FEATS.has(feat.name.display)) {
      continue;
    }

    const parsed = parsePf2oolsFeat(feat);
    result.set(parsed.name, parsed);
  }

  return result;
}

export function parseSpellHeightening(raw: Pf2oolsSpell): HeightenData | undefined {
  if (!raw.data.heightening) {
    return undefined;
  }

  const heightening = raw.data.heightening;

  if (heightening.type === 'interval') {
    return {
      type: 'interval',
      interval: heightening.interval,
      damagePerLevel: heightening.damage,
    };
  }

  if (heightening.type === 'fixed') {
    return {
      type: 'fixed',
      fixedLevels: heightening.levels,
    };
  }

  return undefined;
}
