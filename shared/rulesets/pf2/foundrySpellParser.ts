import type { SpellDefinition, SpellTradition, SpellAreaShape, PF2DamageType } from './types';
import type { HeightenData } from './pf2oolsParser';

export type FoundrySpellData = {
  name: string;
  type: string;
  system: {
    area?: { type: string; value: number } | null;
    damage?: Record<string, { formula: string; type: string; kinds?: string[] }>;
    defense?: { save?: { basic: boolean; statistic: string } } | null;
    heightening?: {
      type: 'interval' | 'fixed';
      interval?: number;
      damage?: Record<string, string>;
      levels?: Record<string, { damage?: Record<string, { formula: string; type?: string }> }>;
    } | null;
    level: { value: number };
    range: { value: string } | null;
    time: { value: string };
    traits: {
      traditions?: string[];
      value: string[];
    };
    duration: { sustained: boolean; value: string };
    target: { value: string } | null;
    description: { value: string };
  };
};

const VALID_TRADITIONS: Set<string> = new Set(['arcane', 'divine', 'occult', 'primal']);
const VALID_SAVES: Set<string> = new Set(['fortitude', 'reflex', 'will']);
const VALID_AREA_SHAPES: Set<string> = new Set(['burst', 'cone', 'line', 'emanation']);
const VALID_DAMAGE_TYPES: Set<string> = new Set([
  'bludgeoning', 'piercing', 'slashing',
  'fire', 'cold', 'electricity', 'acid', 'sonic',
  'positive', 'negative', 'force',
  'mental', 'poison',
]);

function parseTraditions(traits: FoundrySpellData['system']['traits']): SpellTradition[] {
  const traditions = (traits.traditions ?? [])
    .filter(t => VALID_TRADITIONS.has(t)) as SpellTradition[];
  return traditions.length > 0 ? traditions : ['arcane'];
}

function parseCastActions(time: string): SpellDefinition['castActions'] {
  if (time === 'free') return 'free';
  if (time === 'reaction') return 'reaction';
  const num = parseInt(time, 10);
  if (num === 1) return 1;
  if (num === 3) return 3;
  return 2;
}

function parseTargetType(raw: FoundrySpellData): SpellDefinition['targetType'] {
  const traits = raw.system.traits.value ?? [];

  if (traits.includes('attack')) return 'attack';

  if (raw.system.area) return 'area';

  const target = raw.system.target?.value?.toLowerCase() ?? '';
  if (target === 'self' || target.includes('you ') || target === 'you') return 'self';

  return 'single';
}

function parseSave(defense: FoundrySpellData['system']['defense']): SpellDefinition['save'] {
  const stat = defense?.save?.statistic;
  if (stat && VALID_SAVES.has(stat)) {
    return stat as SpellDefinition['save'];
  }
  return undefined;
}

function parseDamageFormula(damage: FoundrySpellData['system']['damage']): { formula: string; type: PF2DamageType } | null {
  if (!damage) return null;

  const entries = Object.values(damage);
  const dmgEntry = entries.find(e => e.kinds?.includes('damage') || !e.kinds);
  if (!dmgEntry) return null;

  const formula = dmgEntry.formula;
  const type = VALID_DAMAGE_TYPES.has(dmgEntry.type)
    ? dmgEntry.type as PF2DamageType
    : 'force';

  return { formula, type };
}

function parseHealFormula(damage: FoundrySpellData['system']['damage']): string | undefined {
  if (!damage) return undefined;

  const entries = Object.values(damage);
  const healEntry = entries.find(e => e.kinds?.includes('healing'));
  return healEntry?.formula;
}

function parseAreaShape(area: FoundrySpellData['system']['area']): SpellAreaShape | undefined {
  if (!area) return undefined;
  if (VALID_AREA_SHAPES.has(area.type)) return area.type as SpellAreaShape;
  return 'burst';
}

function feetToHexes(feetStr: string): number {
  const match = feetStr.match(/(\d+)/);
  if (!match) return 1;
  return Math.max(1, Math.round(parseInt(match[1], 10) / 5));
}

function parseAreaSize(area: FoundrySpellData['system']['area']): number | undefined {
  if (!area || !area.value) return undefined;
  return feetToHexes(`${area.value} feet`);
}

function parseHeightening(heightening: FoundrySpellData['system']['heightening']): HeightenData | undefined {
  if (!heightening) return undefined;

  if (heightening.type === 'interval') {
    const dmgEntries = heightening.damage ? Object.values(heightening.damage) : [];
    const dmgPerLevel = dmgEntries[0];
    return {
      type: 'interval',
      interval: heightening.interval ?? 1,
      damagePerLevel: dmgPerLevel ? `+${dmgPerLevel}` : undefined,
    };
  }

  if (heightening.type === 'fixed' && heightening.levels) {
    const fixedLevels: Record<number, { damage?: string }> = {};
    for (const [levelStr, data] of Object.entries(heightening.levels)) {
      const level = parseInt(levelStr, 10);
      if (data.damage) {
        const dmgEntries = Object.values(data.damage);
        const first = dmgEntries[0];
        if (first) {
          fixedLevels[level] = { damage: first.formula };
        }
      }
    }
    return { type: 'fixed', fixedLevels };
  }

  return undefined;
}

function stripHtml(html: string): string {
  return html
    .replace(/<\/p>\s*<p>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseFoundrySpell(raw: FoundrySpellData): SpellDefinition | null {
  if (raw.type !== 'spell') return null;

  const sys = raw.system;
  const traditions = parseTraditions(sys.traits);
  const castActions = parseCastActions(sys.time.value);
  const targetType = parseTargetType(raw);
  const save = parseSave(sys.defense);
  const dmg = parseDamageFormula(sys.damage);
  const healFormula = parseHealFormula(sys.damage);
  const areaShape = parseAreaShape(sys.area);
  const areaSize = parseAreaSize(sys.area);
  const heighten = parseHeightening(sys.heightening);
  const range = sys.range?.value || undefined;
  const duration = sys.duration.value || undefined;
  const sustained = sys.duration.sustained || undefined;
  const traits = sys.traits.value?.length > 0 ? sys.traits.value : undefined;
  const description = sys.description?.value ? stripHtml(sys.description.value) : undefined;

  return {
    name: raw.name,
    level: sys.level.value,
    traditions,
    castActions,
    targetType,
    save,
    damageFormula: dmg?.formula,
    damageType: dmg?.type,
    healFormula,
    conditions: undefined,
    duration,
    sustained,
    heighten,
    areaShape,
    areaSize,
    range,
    traits,
    description,
  };
}

export function parseFoundrySpells(rawSpells: FoundrySpellData[]): Map<string, SpellDefinition> {
  const result = new Map<string, SpellDefinition>();

  for (const raw of rawSpells) {
    const spell = parseFoundrySpell(raw);
    if (spell) {
      result.set(spell.name, spell);
    }
  }

  return result;
}
