import { describe, it, expect } from 'vitest';
import { isBlocked, isDifficultTerrain, hasCover, getMovementCost, getTerrainAt, hasLineOfSight } from './terrain';
import type { MapDefinition } from './types';

const createTestMap = (): MapDefinition => ({
  id: 'test',
  biome: 'dungeon',
  seed: 1,
  width: 10,
  height: 10,
  cells: [
    { q: 0, r: 0, terrain: [] },
    { q: 1, r: 0, terrain: ['blocked'], propId: 'wall' },
    { q: 2, r: 0, terrain: ['difficult'] },
    { q: 3, r: 0, terrain: ['cover'], propId: 'pillar' },
    { q: 4, r: 0, terrain: ['blocked', 'cover'] },
  ],
  spawnZones: [
    { team: 'player', cells: [{ q: 0, r: 0 }] },
    { team: 'enemy', cells: [{ q: 9, r: 9 }] },
  ],
  props: [
    { id: 'wall', model: 'wall.glb' },
    { id: 'pillar', model: 'pillar.glb' },
  ],
});

describe('Terrain Helpers', () => {
  describe('getTerrainAt', () => {
    it('returns cell when found', () => {
      const map = createTestMap();
      const cell = getTerrainAt(map, 1, 0);
      expect(cell).not.toBeNull();
      expect(cell!.terrain).toContain('blocked');
    });

    it('returns null for non-existent cell', () => {
      const map = createTestMap();
      expect(getTerrainAt(map, 99, 99)).toBeNull();
    });

    it('returns null when map is undefined', () => {
      expect(getTerrainAt(undefined, 0, 0)).toBeNull();
    });
  });

  describe('isBlocked', () => {
    it('returns true for blocked cell', () => {
      const map = createTestMap();
      expect(isBlocked(map, 1, 0)).toBe(true);
    });

    it('returns false for non-blocked cell', () => {
      const map = createTestMap();
      expect(isBlocked(map, 0, 0)).toBe(false);
    });

    it('returns false when map is undefined (backward compat)', () => {
      expect(isBlocked(undefined, 0, 0)).toBe(false);
    });

    it('returns false for non-existent cell', () => {
      const map = createTestMap();
      expect(isBlocked(map, 99, 99)).toBe(false);
    });
  });

  describe('isDifficultTerrain', () => {
    it('returns true for difficult cell', () => {
      const map = createTestMap();
      expect(isDifficultTerrain(map, 2, 0)).toBe(true);
    });

    it('returns false for non-difficult cell', () => {
      const map = createTestMap();
      expect(isDifficultTerrain(map, 0, 0)).toBe(false);
    });

    it('returns false when map is undefined (backward compat)', () => {
      expect(isDifficultTerrain(undefined, 0, 0)).toBe(false);
    });
  });

  describe('hasCover', () => {
    it('returns true for cover cell', () => {
      const map = createTestMap();
      expect(hasCover(map, 3, 0)).toBe(true);
    });

    it('returns false for non-cover cell', () => {
      const map = createTestMap();
      expect(hasCover(map, 0, 0)).toBe(false);
    });

    it('returns false when map is undefined (backward compat)', () => {
      expect(hasCover(undefined, 0, 0)).toBe(false);
    });
  });

  describe('getMovementCost', () => {
    it('returns 1 for normal cell', () => {
      const map = createTestMap();
      expect(getMovementCost(map, 0, 0)).toBe(1);
    });

    it('returns Infinity for blocked cell', () => {
      const map = createTestMap();
      expect(getMovementCost(map, 1, 0)).toBe(Infinity);
    });

    it('returns 2 for difficult terrain', () => {
      const map = createTestMap();
      expect(getMovementCost(map, 2, 0)).toBe(2);
    });

    it('returns 1 when map is undefined (backward compat)', () => {
      expect(getMovementCost(undefined, 0, 0)).toBe(1);
    });

    it('returns 1 for non-existent cell in map', () => {
      const map = createTestMap();
      expect(getMovementCost(map, 99, 99)).toBe(1);
    });
  });

  describe('hasLineOfSight', () => {
    const createLoSMap = (): MapDefinition => ({
      id: 'los-test',
      biome: 'dungeon',
      seed: 1,
      width: 10,
      height: 10,
      cells: [
        { q: 0, r: 0, terrain: [] },
        { q: 1, r: 0, terrain: [] },
        { q: 2, r: 0, terrain: ['blocked'], propId: 'wall' },
        { q: 3, r: 0, terrain: [] },
        { q: 4, r: 0, terrain: [] },
        { q: 0, r: 1, terrain: [] },
        { q: 1, r: 1, terrain: [] },
        { q: 2, r: 1, terrain: [] },
        { q: 3, r: 1, terrain: [] },
        { q: 0, r: 2, terrain: ['blocked'], propId: 'wall' },
        { q: 1, r: 2, terrain: ['blocked'], propId: 'wall' },
        { q: 2, r: 2, terrain: ['blocked'], propId: 'wall' },
        { q: 3, r: 2, terrain: [] },
      ],
      spawnZones: [],
      props: [{ id: 'wall', model: 'wall.glb' }],
    });

    it('returns true when no map (backward compat)', () => {
      expect(hasLineOfSight(undefined, 0, 0, 5, 5)).toBe(true);
    });

    it('returns true for adjacent cells', () => {
      const map = createLoSMap();
      expect(hasLineOfSight(map, 0, 0, 1, 0)).toBe(true);
    });

    it('returns true when path is clear', () => {
      const map = createLoSMap();
      expect(hasLineOfSight(map, 0, 1, 3, 1)).toBe(true);
    });

    it('returns false when wall blocks horizontal path', () => {
      const map = createLoSMap();
      expect(hasLineOfSight(map, 0, 0, 4, 0)).toBe(false);
    });

    it('returns false when wall blocks vertical path', () => {
      const map = createLoSMap();
      expect(hasLineOfSight(map, 0, 0, 0, 3)).toBe(false);
    });

    it('returns true for same cell', () => {
      const map = createLoSMap();
      expect(hasLineOfSight(map, 0, 0, 0, 0)).toBe(true);
    });

    it('does not count start or end cell as blocking', () => {
      const map = createLoSMap();
      expect(hasLineOfSight(map, 2, 0, 3, 0)).toBe(true);
    });
  });
});
