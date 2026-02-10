import { describe, it, expect } from 'vitest';
import { parseFoundrySpell, parseFoundrySpells } from './foundrySpellParser';
import type { FoundrySpellData } from './foundrySpellParser';

function makeFoundrySpell(overrides: Partial<FoundrySpellData> & { system?: Partial<FoundrySpellData['system']> }): FoundrySpellData {
  const base: FoundrySpellData = {
    name: 'Test Spell',
    type: 'spell',
    system: {
      level: { value: 1 },
      time: { value: '2' },
      traits: { traditions: ['arcane'], value: [] },
      duration: { sustained: false, value: '' },
      target: null,
      range: null,
      description: { value: '' },
    },
  };

  return {
    ...base,
    ...overrides,
    system: { ...base.system, ...(overrides.system ?? {}) },
  };
}

describe('parseFoundrySpell', () => {
  it('returns null for non-spell types', () => {
    const raw = makeFoundrySpell({ type: 'feat' });
    expect(parseFoundrySpell(raw)).toBeNull();
  });

  it('parses a basic damage spell with save', () => {
    const raw = makeFoundrySpell({
      name: 'Fireball',
      system: {
        level: { value: 3 },
        time: { value: '2' },
        traits: { traditions: ['arcane', 'primal'], value: ['concentrate', 'fire', 'manipulate'] },
        area: { type: 'burst', value: 20 },
        damage: { '0': { formula: '6d6', type: 'fire', kinds: ['damage'] } },
        defense: { save: { basic: true, statistic: 'reflex' } },
        heightening: {
          type: 'interval',
          interval: 1,
          damage: { '0': '2d6' },
        },
        range: { value: '500 feet' },
        duration: { sustained: false, value: '' },
        target: null,
        description: { value: '<p>A burst of flame.</p>' },
      },
    });

    const result = parseFoundrySpell(raw);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Fireball');
    expect(result!.level).toBe(3);
    expect(result!.traditions).toEqual(['arcane', 'primal']);
    expect(result!.castActions).toBe(2);
    expect(result!.targetType).toBe('area');
    expect(result!.save).toBe('reflex');
    expect(result!.damageFormula).toBe('6d6');
    expect(result!.damageType).toBe('fire');
    expect(result!.areaShape).toBe('burst');
    expect(result!.areaSize).toBe(4);
    expect(result!.range).toBe('500 feet');
    expect(result!.heighten).toEqual({
      type: 'interval',
      interval: 1,
      damagePerLevel: '+2d6',
    });
    expect(result!.description).toBe('A burst of flame.');
  });

  it('parses a healing spell', () => {
    const raw = makeFoundrySpell({
      name: 'Heal',
      system: {
        level: { value: 1 },
        time: { value: '2' },
        traits: { traditions: ['divine', 'primal'], value: ['healing', 'positive'] },
        damage: { '0': { formula: '1d8', type: 'healing', kinds: ['healing'] } },
        range: { value: '30 feet' },
        duration: { sustained: false, value: '' },
        target: { value: '1 willing creature' },
        description: { value: '' },
      },
    });

    const result = parseFoundrySpell(raw);
    expect(result!.healFormula).toBe('1d8');
    expect(result!.damageFormula).toBeUndefined();
    expect(result!.targetType).toBe('single');
  });

  it('parses an attack roll spell', () => {
    const raw = makeFoundrySpell({
      name: 'Ray of Frost',
      system: {
        level: { value: 0 },
        time: { value: '2' },
        traits: { traditions: ['arcane', 'primal'], value: ['attack', 'cantrip', 'cold'] },
        damage: { '0': { formula: '1d4', type: 'cold', kinds: ['damage'] } },
        range: { value: '120 feet' },
        duration: { sustained: false, value: '' },
        target: { value: '1 creature' },
        description: { value: '' },
      },
    });

    const result = parseFoundrySpell(raw);
    expect(result!.targetType).toBe('attack');
    expect(result!.damageFormula).toBe('1d4');
    expect(result!.damageType).toBe('cold');
  });

  it('parses a self-targeting spell', () => {
    const raw = makeFoundrySpell({
      name: 'Shield',
      system: {
        level: { value: 0 },
        time: { value: '1' },
        traits: { traditions: ['arcane', 'divine'], value: ['cantrip', 'concentrate'] },
        duration: { sustained: false, value: 'until the start of your next turn' },
        target: { value: 'self' },
        range: null,
        description: { value: '' },
      },
    });

    const result = parseFoundrySpell(raw);
    expect(result!.targetType).toBe('self');
    expect(result!.castActions).toBe(1);
    expect(result!.duration).toBe('until the start of your next turn');
  });

  it('parses a cone area spell', () => {
    const raw = makeFoundrySpell({
      name: 'Burning Hands',
      system: {
        level: { value: 1 },
        time: { value: '2' },
        traits: { traditions: ['arcane', 'primal'], value: ['fire'] },
        area: { type: 'cone', value: 15 },
        damage: { '0': { formula: '2d6', type: 'fire', kinds: ['damage'] } },
        defense: { save: { basic: true, statistic: 'reflex' } },
        duration: { sustained: false, value: '' },
        target: null,
        range: null,
        description: { value: '' },
      },
    });

    const result = parseFoundrySpell(raw);
    expect(result!.targetType).toBe('area');
    expect(result!.areaShape).toBe('cone');
    expect(result!.areaSize).toBe(3);
  });

  it('parses a line area spell', () => {
    const raw = makeFoundrySpell({
      name: 'Lightning Bolt',
      system: {
        level: { value: 3 },
        time: { value: '2' },
        traits: { traditions: ['arcane', 'primal'], value: ['electricity'] },
        area: { type: 'line', value: 60 },
        damage: { '0': { formula: '4d12', type: 'electricity', kinds: ['damage'] } },
        defense: { save: { basic: true, statistic: 'reflex' } },
        duration: { sustained: false, value: '' },
        target: null,
        range: null,
        description: { value: '' },
      },
    });

    const result = parseFoundrySpell(raw);
    expect(result!.areaShape).toBe('line');
    expect(result!.areaSize).toBe(12);
  });

  it('parses a sustained spell', () => {
    const raw = makeFoundrySpell({
      name: 'Flaming Sphere',
      system: {
        level: { value: 2 },
        time: { value: '2' },
        traits: { traditions: ['arcane', 'primal'], value: ['fire'] },
        damage: { '0': { formula: '3d6', type: 'fire', kinds: ['damage'] } },
        defense: { save: { basic: true, statistic: 'reflex' } },
        duration: { sustained: true, value: '1 minute' },
        range: { value: '30 feet' },
        target: null,
        description: { value: '' },
      },
    });

    const result = parseFoundrySpell(raw);
    expect(result!.sustained).toBe(true);
    expect(result!.duration).toBe('1 minute');
  });

  it('parses multi-tradition spells', () => {
    const raw = makeFoundrySpell({
      name: 'Fear',
      system: {
        level: { value: 1 },
        time: { value: '2' },
        traits: { traditions: ['arcane', 'divine', 'occult', 'primal'], value: ['emotion', 'fear', 'mental'] },
        defense: { save: { basic: false, statistic: 'will' } },
        duration: { sustained: false, value: 'varies' },
        target: { value: '1 creature' },
        range: { value: '30 feet' },
        description: { value: '' },
      },
    });

    const result = parseFoundrySpell(raw);
    expect(result!.traditions).toEqual(['arcane', 'divine', 'occult', 'primal']);
  });

  it('parses fixed heightening', () => {
    const raw = makeFoundrySpell({
      name: 'Magic Missile',
      system: {
        level: { value: 1 },
        time: { value: '2' },
        traits: { traditions: ['arcane', 'occult'], value: ['force'] },
        damage: { '0': { formula: '1d4+1', type: 'force', kinds: ['damage'] } },
        heightening: {
          type: 'fixed',
          levels: {
            '3': { damage: { '0': { formula: '+1d4+1' } } },
            '5': { damage: { '0': { formula: '+1d4+1' } } },
          },
        },
        range: { value: '120 feet' },
        duration: { sustained: false, value: '' },
        target: { value: '1 creature' },
        description: { value: '' },
      },
    });

    const result = parseFoundrySpell(raw);
    expect(result!.heighten).toEqual({
      type: 'fixed',
      fixedLevels: {
        3: { damage: '+1d4+1' },
        5: { damage: '+1d4+1' },
      },
    });
  });

  it('parses free action spells', () => {
    const raw = makeFoundrySpell({
      name: 'Guidance',
      system: {
        level: { value: 0 },
        time: { value: 'free' },
        traits: { traditions: ['divine', 'occult', 'primal'], value: ['cantrip'] },
        duration: { sustained: false, value: 'until the start of your next turn' },
        target: { value: '1 creature' },
        range: { value: '30 feet' },
        description: { value: '' },
      },
    });

    const result = parseFoundrySpell(raw);
    expect(result!.castActions).toBe('free');
  });

  it('parses reaction spells', () => {
    const raw = makeFoundrySpell({
      name: 'Feather Fall',
      system: {
        level: { value: 1 },
        time: { value: 'reaction' },
        traits: { traditions: ['arcane', 'primal'], value: [] },
        duration: { sustained: false, value: '1 minute' },
        target: { value: '1 falling creature' },
        range: { value: '60 feet' },
        description: { value: '' },
      },
    });

    const result = parseFoundrySpell(raw);
    expect(result!.castActions).toBe('reaction');
  });

  it('strips HTML from description', () => {
    const raw = makeFoundrySpell({
      system: {
        level: { value: 1 },
        time: { value: '2' },
        traits: { traditions: ['arcane'], value: [] },
        duration: { sustained: false, value: '' },
        target: null,
        range: null,
        description: { value: '<p>You shoot a <strong>blazing</strong> bolt of fire.</p><p>It deals &amp; burns.</p>' },
      },
    });

    const result = parseFoundrySpell(raw);
    expect(result!.description).toBe('You shoot a blazing bolt of fire. It deals & burns.');
  });

  it('defaults to arcane when no traditions provided', () => {
    const raw = makeFoundrySpell({
      system: {
        level: { value: 1 },
        time: { value: '2' },
        traits: { value: [] },
        duration: { sustained: false, value: '' },
        target: null,
        range: null,
        description: { value: '' },
      },
    });

    const result = parseFoundrySpell(raw);
    expect(result!.traditions).toEqual(['arcane']);
  });
});

describe('parseFoundrySpells', () => {
  it('parses multiple spells and filters non-spells', () => {
    const rawSpells: FoundrySpellData[] = [
      makeFoundrySpell({ name: 'Spell A', type: 'spell' }),
      makeFoundrySpell({ name: 'Not A Spell', type: 'feat' }),
      makeFoundrySpell({ name: 'Spell B', type: 'spell' }),
    ];

    const result = parseFoundrySpells(rawSpells);
    expect(result.size).toBe(2);
    expect(result.has('Spell A')).toBe(true);
    expect(result.has('Spell B')).toBe(true);
    expect(result.has('Not A Spell')).toBe(false);
  });
});
