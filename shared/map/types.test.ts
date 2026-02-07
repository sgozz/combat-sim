import { describe, it, expect } from 'vitest';
import type { MapDefinition, TerrainCell, SpawnZone, BiomeId, TerrainProperty, PropDefinition } from './types';

describe('Map Types', () => {
  it('creates a valid MapDefinition with all fields', () => {
    const map: MapDefinition = {
      id: 'test-map-1',
      biome: 'dungeon',
      seed: 12345,
      width: 20,
      height: 20,
      cells: [],
      spawnZones: [],
      props: [],
    };
    expect(map.id).toBe('test-map-1');
    expect(map.biome).toBe('dungeon');
    expect(map.seed).toBe(12345);
    expect(map.width).toBe(20);
    expect(map.height).toBe(20);
    expect(map.cells).toHaveLength(0);
    expect(map.spawnZones).toHaveLength(0);
    expect(map.props).toHaveLength(0);
  });

  it('creates a MapDefinition with wilderness biome', () => {
    const map: MapDefinition = {
      id: 'test-map-2',
      biome: 'wilderness',
      seed: 99999,
      width: 30,
      height: 30,
      cells: [],
      spawnZones: [],
      props: [],
    };
    expect(map.biome).toBe('wilderness');
  });

  it('creates TerrainCell with all terrain properties', () => {
    const cell: TerrainCell = {
      q: 5,
      r: -3,
      terrain: ['blocked', 'difficult', 'cover'],
    };
    expect(cell.q).toBe(5);
    expect(cell.r).toBe(-3);
    expect(cell.terrain).toContain('blocked');
    expect(cell.terrain).toContain('difficult');
    expect(cell.terrain).toContain('cover');
    expect(cell.terrain).toHaveLength(3);
  });

  it('creates TerrainCell with optional propId and propRotation', () => {
    const cell: TerrainCell = {
      q: 0,
      r: 0,
      terrain: ['blocked'],
      propId: 'wall',
      propRotation: Math.PI / 2,
    };
    expect(cell.propId).toBe('wall');
    expect(cell.propRotation).toBe(Math.PI / 2);
  });

  it('creates TerrainCell with empty terrain array', () => {
    const cell: TerrainCell = {
      q: 1,
      r: 1,
      terrain: [],
    };
    expect(cell.terrain).toHaveLength(0);
  });

  it('creates SpawnZone for player team', () => {
    const zone: SpawnZone = {
      team: 'player',
      cells: [
        { q: 0, r: 0 },
        { q: 1, r: 0 },
        { q: 0, r: 1 },
      ],
    };
    expect(zone.team).toBe('player');
    expect(zone.cells).toHaveLength(3);
  });

  it('creates SpawnZone for enemy team', () => {
    const zone: SpawnZone = {
      team: 'enemy',
      cells: [
        { q: 10, r: -5 },
        { q: 11, r: -5 },
      ],
    };
    expect(zone.team).toBe('enemy');
    expect(zone.cells).toHaveLength(2);
  });

  it('creates PropDefinition with optional scale', () => {
    const prop: PropDefinition = {
      id: 'wall',
      model: 'wall.glb',
      scale: 1.5,
    };
    expect(prop.id).toBe('wall');
    expect(prop.model).toBe('wall.glb');
    expect(prop.scale).toBe(1.5);
  });

  it('creates PropDefinition without scale', () => {
    const prop: PropDefinition = {
      id: 'tree',
      model: 'tree_01.glb',
    };
    expect(prop.id).toBe('tree');
    expect(prop.scale).toBeUndefined();
  });

  it('creates a complete MapDefinition with cells, spawn zones, and props', () => {
    const map: MapDefinition = {
      id: 'full-map',
      biome: 'dungeon',
      seed: 42,
      width: 15,
      height: 15,
      cells: [
        { q: 0, r: 0, terrain: [] },
        { q: 1, r: 0, terrain: ['blocked'], propId: 'wall' },
        { q: 2, r: 0, terrain: ['difficult'] },
        { q: 3, r: 0, terrain: ['cover'], propId: 'pillar', propRotation: 0 },
      ],
      spawnZones: [
        { team: 'player', cells: [{ q: 0, r: 0 }] },
        { team: 'enemy', cells: [{ q: 14, r: 14 }] },
      ],
      props: [
        { id: 'wall', model: 'wall.glb', scale: 1.0 },
        { id: 'pillar', model: 'pillar.glb' },
      ],
    };
    expect(map.cells).toHaveLength(4);
    expect(map.spawnZones).toHaveLength(2);
    expect(map.props).toHaveLength(2);
    expect(map.cells[1].propId).toBe('wall');
    expect(map.spawnZones[0].team).toBe('player');
    expect(map.spawnZones[1].team).toBe('enemy');
  });

  it('validates BiomeId values', () => {
    const dungeon: BiomeId = 'dungeon';
    const wilderness: BiomeId = 'wilderness';
    expect(dungeon).toBe('dungeon');
    expect(wilderness).toBe('wilderness');
  });

  it('validates TerrainProperty values', () => {
    const blocked: TerrainProperty = 'blocked';
    const difficult: TerrainProperty = 'difficult';
    const cover: TerrainProperty = 'cover';
    expect(blocked).toBe('blocked');
    expect(difficult).toBe('difficult');
    expect(cover).toBe('cover');
  });
});
