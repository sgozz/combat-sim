import { describe, it, expect } from 'vitest';
import { parsePf2oolsFeat, loadFeatsFromPf2ools } from './pf2oolsParser';
import type { Pf2oolsFeat } from './pf2oolsParser';

describe('parsePf2oolsFeat', () => {
  it('converts Pf2ools format to PF2FeatDefinition', () => {
    const raw: Pf2oolsFeat = {
      type: 'feat',
      name: { display: 'Attack of Opportunity' },
      data: {
        level: 1,
        traits: ['fighter'],
        actionCost: { actions: 0 }, // reaction
        description: 'You can react when an enemy moves away...'
      },
      tags: { source: { title: 'Core Rulebook', page: 144 } }
    };

    const result = parsePf2oolsFeat(raw);

    expect(result.name).toBe('Attack of Opportunity');
    expect(result.level).toBe(1);
    expect(result.traits).toEqual(['fighter']);
    expect(result.actionCost).toBe(0);
    expect(result.source).toBe('Core Rulebook');
  });

  it('handles feats with prerequisites', () => {
    const raw: Pf2oolsFeat = {
      type: 'feat',
      name: { display: 'Power Attack' },
      data: {
        level: 1,
        traits: ['fighter'],
        actionCost: { actions: 2 },
        prerequisites: ['trained in martial weapons'],
        description: 'You make a powerful strike...'
      },
      tags: { source: { title: 'Core Rulebook', page: 150 } }
    };

    const result = parsePf2oolsFeat(raw);

    expect(result.prerequisites).toEqual(['trained in martial weapons']);
    expect(result.actionCost).toBe(2);
  });

  it('handles feats without actionCost', () => {
    const raw: Pf2oolsFeat = {
      type: 'feat',
      name: { display: 'Some Passive Feat' },
      data: {
        level: 1,
        traits: [],
        description: 'This is a passive feat...'
      },
      tags: { source: { title: 'Core Rulebook', page: 100 } }
    };

    const result = parsePf2oolsFeat(raw);

    expect(result.actionCost).toBeUndefined();
  });

  it('extracts source from tags', () => {
    const raw: Pf2oolsFeat = {
      type: 'feat',
      name: { display: 'Test Feat' },
      data: {
        level: 1,
        traits: [],
        description: 'Test'
      },
      tags: { source: { title: 'Advanced Player\'s Guide', page: 42 } }
    };

    const result = parsePf2oolsFeat(raw);

    expect(result.source).toBe('Advanced Player\'s Guide');
  });
});

describe('loadFeatsFromPf2ools', () => {
  it('loads Attack of Opportunity from data', () => {
    const mockData: Pf2oolsFeat[] = [
      {
        type: 'feat',
        name: { display: 'Attack of Opportunity' },
        data: {
          level: 1,
          traits: ['fighter'],
          actionCost: { actions: 0 },
          description: 'You can react...'
        },
        tags: { source: { title: 'Core Rulebook', page: 144 } }
      }
    ];

    const result = loadFeatsFromPf2ools(mockData);

    expect(result.has('Attack of Opportunity')).toBe(true);
    expect(result.get('Attack of Opportunity')?.level).toBe(1);
  });

  it('loads all 8 target feats', () => {
    const targetFeats = [
      'Attack of Opportunity',
      'Shield Block',
      'Power Attack',
      'Sudden Charge',
      'Reactive Shield',
      'Intimidating Strike',
      'Combat Grab',
      'Knockdown'
    ];

    const mockData: Pf2oolsFeat[] = targetFeats.map((name, idx) => ({
      type: 'feat',
      name: { display: name },
      data: {
        level: 1,
        traits: ['fighter'],
        actionCost: { actions: idx % 2 },
        description: `${name} description`
      },
      tags: { source: { title: 'Core Rulebook', page: 100 + idx } }
    }));

    const result = loadFeatsFromPf2ools(mockData);

    expect(result.size).toBe(8);
    targetFeats.forEach(name => {
      expect(result.has(name)).toBe(true);
    });
  });

  it('filters out non-target feats', () => {
    const mockData: Pf2oolsFeat[] = [
      {
        type: 'feat',
        name: { display: 'Attack of Opportunity' },
        data: {
          level: 1,
          traits: ['fighter'],
          actionCost: { actions: 0 },
          description: 'AoO'
        },
        tags: { source: { title: 'Core Rulebook', page: 144 } }
      },
      {
        type: 'feat',
        name: { display: 'Some Random Feat' },
        data: {
          level: 1,
          traits: ['rogue'],
          description: 'Random feat'
        },
        tags: { source: { title: 'Core Rulebook', page: 200 } }
      },
      {
        type: 'feat',
        name: { display: 'Another Random Feat' },
        data: {
          level: 2,
          traits: ['wizard'],
          description: 'Another random'
        },
        tags: { source: { title: 'Core Rulebook', page: 201 } }
      }
    ];

    const result = loadFeatsFromPf2ools(mockData);

    expect(result.size).toBe(1);
    expect(result.has('Attack of Opportunity')).toBe(true);
    expect(result.has('Some Random Feat')).toBe(false);
    expect(result.has('Another Random Feat')).toBe(false);
  });

  it('handles empty data array', () => {
    const result = loadFeatsFromPf2ools([]);

    expect(result.size).toBe(0);
  });

  it('handles data with non-feat entries', () => {
    const mockData = [
      {
        type: 'feat',
        name: { display: 'Attack of Opportunity' },
        data: {
          level: 1,
          traits: ['fighter'],
          actionCost: { actions: 0 },
          description: 'AoO'
        },
        tags: { source: { title: 'Core Rulebook', page: 144 } }
      },
      {
        type: 'spell', // Not a feat
        name: { display: 'Fireball' },
        data: { level: 3 }
      }
    ] as unknown[];

    const result = loadFeatsFromPf2ools(mockData);

    expect(result.size).toBe(1);
    expect(result.has('Attack of Opportunity')).toBe(true);
  });

  it('returns Map with correct structure', () => {
    const mockData: Pf2oolsFeat[] = [
      {
        type: 'feat',
        name: { display: 'Shield Block' },
        data: {
          level: 1,
          traits: ['fighter'],
          actionCost: { actions: 0 },
          description: 'Shield Block description'
        },
        tags: { source: { title: 'Core Rulebook', page: 145 } }
      }
    ];

    const result = loadFeatsFromPf2ools(mockData);
    const feat = result.get('Shield Block');

    expect(feat).toBeDefined();
    expect(feat?.name).toBe('Shield Block');
    expect(feat?.level).toBe(1);
    expect(feat?.traits).toContain('fighter');
    expect(feat?.actionCost).toBe(0);
  });
});
