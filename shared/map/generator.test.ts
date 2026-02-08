import { describe, it, expect } from 'vitest';
import { generateMap } from './generator';
import type { MapDefinition, TerrainCell } from './types';

function getCell(map: MapDefinition, q: number, r: number): TerrainCell | undefined {
  return map.cells.find(c => c.q === q && c.r === r);
}

function isBlocked(cell: TerrainCell | undefined): boolean {
  return cell?.terrain.includes('blocked') ?? false;
}

function getWalkableCells(map: MapDefinition): TerrainCell[] {
  return map.cells.filter(c => !c.terrain.includes('blocked'));
}

function hexDist(q: number, r: number): number {
  return (Math.abs(q) + Math.abs(q + r) + Math.abs(r)) / 2;
}

function floodFill(map: MapDefinition, startQ: number, startR: number): Set<string> {
  const visited = new Set<string>();
  const allCoords = new Set(map.cells.map(c => `${c.q},${c.r}`));
  const blocked = new Set(
    map.cells.filter(c => c.terrain.includes('blocked')).map(c => `${c.q},${c.r}`)
  );
  const queue: [number, number][] = [[startQ, startR]];
  const key = (q: number, r: number) => `${q},${r}`;

  while (queue.length > 0) {
    const [q, r] = queue.shift()!;
    const k = key(q, r);
    if (visited.has(k) || blocked.has(k)) continue;
    if (!allCoords.has(k)) continue;
    visited.add(k);

    queue.push([q + 1, r], [q - 1, r], [q, r + 1], [q, r - 1]);
  }
  return visited;
}

describe('Map Generator', () => {
  describe('Dungeon biome', () => {
    it('generates a valid MapDefinition', () => {
      const map = generateMap('dungeon', { seed: 42, gridType: 'hex' });
      expect(map.biome).toBe('dungeon');
      expect(map.seed).toBe(42);
      expect(map.width).toBe(21);
      expect(map.height).toBe(21);
      expect(map.cells.length).toBeGreaterThan(0);
      expect(map.spawnZones).toHaveLength(2);
      expect(map.props.length).toBeGreaterThan(0);
    });

    it('has walkable rooms (not all cells are blocked)', () => {
      const map = generateMap('dungeon', { seed: 42, gridType: 'hex' });
      const walkable = getWalkableCells(map);
      expect(walkable.length).toBeGreaterThan(20);
    });

    it('has connected walkable areas', () => {
      const map = generateMap('dungeon', { seed: 42, gridType: 'hex' });
      const walkable = getWalkableCells(map);
      expect(walkable.length).toBeGreaterThan(0);

      const start = walkable[0];
      const reachable = floodFill(map, start.q, start.r);

      const walkableKeys = new Set(walkable.map(c => `${c.q},${c.r}`));
      for (const key of walkableKeys) {
        expect(reachable.has(key)).toBe(true);
      }
    });

    it('has spawn zones with non-blocked cells', () => {
      const map = generateMap('dungeon', { seed: 42, gridType: 'hex' });
      const playerZone = map.spawnZones.find(z => z.team === 'player');
      const enemyZone = map.spawnZones.find(z => z.team === 'enemy');

      expect(playerZone).toBeDefined();
      expect(enemyZone).toBeDefined();
      expect(playerZone!.cells.length).toBeGreaterThanOrEqual(2);
      expect(enemyZone!.cells.length).toBeGreaterThanOrEqual(2);

      for (const spawn of playerZone!.cells) {
        const cell = getCell(map, spawn.q, spawn.r);
        expect(isBlocked(cell)).toBe(false);
      }
      for (const spawn of enemyZone!.cells) {
        const cell = getCell(map, spawn.q, spawn.r);
        expect(isBlocked(cell)).toBe(false);
      }
    });

    it('has cover props inside rooms', () => {
      const map = generateMap('dungeon', { seed: 42, gridType: 'hex' });
      const coverCells = map.cells.filter(c => c.terrain.includes('cover'));
      expect(coverCells.length).toBeGreaterThan(0);
    });

    it('has wall props on blocked cells', () => {
      const map = generateMap('dungeon', { seed: 42, gridType: 'hex' });
      const wallCells = map.cells.filter(c => c.propId === 'wall');
      expect(wallCells.length).toBeGreaterThan(0);
      for (const cell of wallCells) {
        expect(cell.terrain).toContain('blocked');
      }
    });

    it('works with custom radius', () => {
      const map = generateMap('dungeon', { seed: 42, gridType: 'hex', radius: 12 });
      expect(map.width).toBe(25);
      expect(map.height).toBe(25);
    });

    it('hex cells are within hex radius', () => {
      const map = generateMap('dungeon', { seed: 42, gridType: 'hex' });
      const radius = (map.width - 1) / 2;
      for (const cell of map.cells) {
        expect(hexDist(cell.q, cell.r)).toBeLessThanOrEqual(radius);
      }
    });
  });

  describe('Wilderness biome', () => {
    it('generates a valid MapDefinition', () => {
      const map = generateMap('wilderness', { seed: 42, gridType: 'hex' });
      expect(map.biome).toBe('wilderness');
      expect(map.seed).toBe(42);
      expect(map.width).toBe(19);
      expect(map.height).toBe(19);
      expect(map.cells.length).toBeGreaterThan(0);
      expect(map.spawnZones).toHaveLength(2);
    });

    it('has open center area', () => {
      const map = generateMap('wilderness', { seed: 42, gridType: 'hex' });
      const centerCells = map.cells.filter(c => hexDist(c.q, c.r) <= 3);
      const blockedCenter = centerCells.filter(c => c.terrain.includes('blocked'));
      const openRatio = 1 - blockedCenter.length / centerCells.length;
      expect(openRatio).toBeGreaterThan(0.7);
    });

    it('has tree line around perimeter', () => {
      const map = generateMap('wilderness', { seed: 42, gridType: 'hex' });
      const radius = (map.width - 1) / 2;
      const edgeCells = map.cells.filter(c => hexDist(c.q, c.r) === radius);
      const blockedEdge = edgeCells.filter(c => c.terrain.includes('blocked'));
      expect(blockedEdge.length).toBeGreaterThan(edgeCells.length * 0.5);
    });

    it('has scattered rocks with cover', () => {
      const map = generateMap('wilderness', { seed: 42, gridType: 'hex' });
      const coverCells = map.cells.filter(c => c.terrain.includes('cover'));
      expect(coverCells.length).toBeGreaterThan(0);
    });

    it('has bushes with difficult terrain', () => {
      const map = generateMap('wilderness', { seed: 42, gridType: 'hex' });
      const difficultCells = map.cells.filter(c => c.terrain.includes('difficult'));
      expect(difficultCells.length).toBeGreaterThan(0);
    });

    it('has spawn zones on opposite sides', () => {
      const map = generateMap('wilderness', { seed: 42, gridType: 'hex' });
      const playerZone = map.spawnZones.find(z => z.team === 'player')!;
      const enemyZone = map.spawnZones.find(z => z.team === 'enemy')!;

      expect(playerZone.cells.length).toBeGreaterThanOrEqual(3);
      expect(enemyZone.cells.length).toBeGreaterThanOrEqual(3);

      const avgPlayerQ = playerZone.cells.reduce((s, c) => s + c.q, 0) / playerZone.cells.length;
      const avgEnemyQ = enemyZone.cells.reduce((s, c) => s + c.q, 0) / enemyZone.cells.length;
      expect(avgEnemyQ).toBeGreaterThan(avgPlayerQ);
    });
  });

  describe('Seed determinism', () => {
    it('same seed produces identical dungeon maps', () => {
      const map1 = generateMap('dungeon', { seed: 12345, gridType: 'hex' });
      const map2 = generateMap('dungeon', { seed: 12345, gridType: 'hex' });
      expect(map1).toEqual(map2);
    });

    it('same seed produces identical wilderness maps', () => {
      const map1 = generateMap('wilderness', { seed: 67890, gridType: 'hex' });
      const map2 = generateMap('wilderness', { seed: 67890, gridType: 'hex' });
      expect(map1).toEqual(map2);
    });

    it('different seeds produce different maps', () => {
      const map1 = generateMap('dungeon', { seed: 1, gridType: 'hex' });
      const map2 = generateMap('dungeon', { seed: 2, gridType: 'hex' });
      expect(map1.cells).not.toEqual(map2.cells);
    });
  });

  describe('Grid type support', () => {
    it('works with hex grid type', () => {
      const map = generateMap('dungeon', { seed: 42, gridType: 'hex' });
      expect(map.cells.length).toBeGreaterThan(0);
    });

    it('works with square grid type', () => {
      const map = generateMap('dungeon', { seed: 42, gridType: 'square' });
      expect(map.cells.length).toBeGreaterThan(0);
    });
  });

  describe('Props consistency', () => {
    it('all cells with propId have corresponding entry in props array', () => {
      const map = generateMap('dungeon', { seed: 42, gridType: 'hex' });
      const propIdsInCells = new Set(map.cells.filter(c => c.propId).map(c => c.propId!));
      const propIdsInArray = new Set(map.props.map(p => p.id));

      for (const id of propIdsInCells) {
        expect(propIdsInArray.has(id)).toBe(true);
      }
    });

    it('wilderness props have corresponding entries', () => {
      const map = generateMap('wilderness', { seed: 42, gridType: 'hex' });
      const propIdsInCells = new Set(map.cells.filter(c => c.propId).map(c => c.propId!));
      const propIdsInArray = new Set(map.props.map(p => p.id));

      for (const id of propIdsInCells) {
        expect(propIdsInArray.has(id)).toBe(true);
      }
    });
  });
});
