import { describe, it, expect } from 'vitest';
import { HexGridSystem } from './HexGridSystem';
import { SquareGridSystem } from './SquareGridSystem';
import type { GridCoord } from './types';

describe('HexGridSystem', () => {
  const hex = new HexGridSystem();

  describe('distance', () => {
    it('returns 0 for same coordinate', () => {
      expect(hex.distance({ q: 0, r: 0 }, { q: 0, r: 0 })).toBe(0);
    });

    it('returns 1 for adjacent hexes', () => {
      const neighbors = hex.neighbors({ q: 0, r: 0 });
      neighbors.forEach(n => {
        expect(hex.distance({ q: 0, r: 0 }, n)).toBe(1);
      });
    });

    it('calculates correct distance for non-adjacent hexes', () => {
      expect(hex.distance({ q: 0, r: 0 }, { q: 2, r: 0 })).toBe(2);
      expect(hex.distance({ q: 0, r: 0 }, { q: 3, r: -3 })).toBe(3);
      expect(hex.distance({ q: -2, r: 1 }, { q: 1, r: -2 })).toBe(3);
    });
  });

  describe('neighbors', () => {
    it('returns 6 neighbors', () => {
      const neighbors = hex.neighbors({ q: 0, r: 0 });
      expect(neighbors).toHaveLength(6);
    });

    it('all neighbors are at distance 1', () => {
      const center: GridCoord = { q: 5, r: -3 };
      const neighbors = hex.neighbors(center);
      neighbors.forEach(n => {
        expect(hex.distance(center, n)).toBe(1);
      });
    });
  });

  describe('coordToWorld / worldToCoord', () => {
    it('round-trips correctly for origin', () => {
      const coord: GridCoord = { q: 0, r: 0 };
      const world = hex.coordToWorld(coord);
      const back = hex.worldToCoord(world);
      expect(back).toEqual(coord);
    });

    it('round-trips correctly for arbitrary coordinate', () => {
      const coord: GridCoord = { q: 3, r: -2 };
      const world = hex.coordToWorld(coord);
      const back = hex.worldToCoord(world);
      expect(back).toEqual(coord);
    });
  });

  describe('getNeighborInDirection', () => {
    it('returns correct neighbor for each direction', () => {
      const center: GridCoord = { q: 0, r: 0 };
      for (let dir = 0; dir < 6; dir++) {
        const neighbor = hex.getNeighborInDirection(center, dir);
        expect(hex.distance(center, neighbor)).toBe(1);
      }
    });
  });
});

describe('SquareGridSystem', () => {
  describe('4-direction grid', () => {
    const sq4 = new SquareGridSystem(4);

    it('has 4 directions', () => {
      expect(sq4.directions).toBe(4);
    });

    it('returns 4 neighbors', () => {
      const neighbors = sq4.neighbors({ q: 0, r: 0 });
      expect(neighbors).toHaveLength(4);
    });

    it('calculates Manhattan distance', () => {
      expect(sq4.distance({ q: 0, r: 0 }, { q: 0, r: 0 })).toBe(0);
      expect(sq4.distance({ q: 0, r: 0 }, { q: 1, r: 0 })).toBe(1);
      expect(sq4.distance({ q: 0, r: 0 }, { q: 1, r: 1 })).toBe(2);
      expect(sq4.distance({ q: 0, r: 0 }, { q: 3, r: 4 })).toBe(7);
    });
  });

  describe('8-direction grid', () => {
    const sq8 = new SquareGridSystem(8);

    it('has 8 directions', () => {
      expect(sq8.directions).toBe(8);
    });

    it('returns 8 neighbors', () => {
      const neighbors = sq8.neighbors({ q: 0, r: 0 });
      expect(neighbors).toHaveLength(8);
    });

    it('calculates Chebyshev distance', () => {
      expect(sq8.distance({ q: 0, r: 0 }, { q: 0, r: 0 })).toBe(0);
      expect(sq8.distance({ q: 0, r: 0 }, { q: 1, r: 0 })).toBe(1);
      expect(sq8.distance({ q: 0, r: 0 }, { q: 1, r: 1 })).toBe(1);
      expect(sq8.distance({ q: 0, r: 0 }, { q: 3, r: 4 })).toBe(4);
    });

    it('all 8 neighbors are at distance 1', () => {
      const center: GridCoord = { q: 5, r: 5 };
      const neighbors = sq8.neighbors(center);
      neighbors.forEach(n => {
        expect(sq8.distance(center, n)).toBe(1);
      });
    });
  });

  describe('coordToWorld / worldToCoord', () => {
    const sq8 = new SquareGridSystem(8);

    it('has 1:1 mapping for squares', () => {
      const coord: GridCoord = { q: 3, r: -5 };
      const world = sq8.coordToWorld(coord);
      expect(world.x).toBe(3);
      expect(world.z).toBe(-5);
    });

    it('round-trips correctly', () => {
      const coord: GridCoord = { q: 7, r: -2 };
      const world = sq8.coordToWorld(coord);
      const back = sq8.worldToCoord(world);
      expect(back).toEqual(coord);
    });
  });
});

describe('Grid type comparison', () => {
  const hex = new HexGridSystem();
  const sq8 = new SquareGridSystem(8);

  it('hex and square have different direction counts', () => {
    expect(hex.directions).toBe(6);
    expect(sq8.directions).toBe(8);
  });

  it('hex and square have different types', () => {
    expect(hex.type).toBe('hex');
    expect(sq8.type).toBe('square');
  });

  it('both implement the same interface', () => {
    const coord: GridCoord = { q: 2, r: 3 };
    
    expect(typeof hex.distance(coord, coord)).toBe('number');
    expect(typeof sq8.distance(coord, coord)).toBe('number');
    
    expect(Array.isArray(hex.neighbors(coord))).toBe(true);
    expect(Array.isArray(sq8.neighbors(coord))).toBe(true);
    
    expect(typeof hex.coordToWorld(coord).x).toBe('number');
    expect(typeof sq8.coordToWorld(coord).x).toBe('number');
  });
});
