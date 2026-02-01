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

export interface PF2FeatDefinition extends PF2Feat {
  actionCost?: number;
  traits: string[];
  prerequisites?: string[];
  source?: string;
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
