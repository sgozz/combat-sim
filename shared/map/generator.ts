import type { BiomeId, MapDefinition, TerrainCell, SpawnZone, PropDefinition } from './types';
import type { GridType } from '../grid/types';

function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

type GeneratorOptions = {
  seed: number;
  gridType: GridType;
  radius?: number;
};

function coordKey(q: number, r: number): string {
  return `${q},${r}`;
}

function randInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function hexDistance(q1: number, r1: number, q2: number, r2: number): number {
  return (Math.abs(q1 - q2) + Math.abs(q1 + r1 - q2 - r2) + Math.abs(r1 - r2)) / 2;
}

function getAllCells(radius: number, gridType: GridType): { q: number; r: number }[] {
  const cells: { q: number; r: number }[] = [];
  if (gridType === 'hex') {
    for (let q = -radius; q <= radius; q++) {
      for (let r = -radius; r <= radius; r++) {
        if (hexDistance(0, 0, q, r) <= radius) {
          cells.push({ q, r });
        }
      }
    }
  } else {
    for (let q = -radius; q <= radius; q++) {
      for (let r = -radius; r <= radius; r++) {
        cells.push({ q, r });
      }
    }
  }
  return cells;
}

function isEdgeCell(q: number, r: number, radius: number, gridType: GridType): boolean {
  if (gridType === 'hex') {
    return hexDistance(0, 0, q, r) === radius;
  }
  return Math.abs(q) === radius || Math.abs(r) === radius;
}

function isNearEdgeCell(q: number, r: number, radius: number, gridType: GridType): boolean {
  if (gridType === 'hex') {
    const d = hexDistance(0, 0, q, r);
    return d === radius - 1;
  }
  return Math.abs(q) === radius - 1 || Math.abs(r) === radius - 1;
}

function distFromCenter(q: number, r: number, gridType: GridType): number {
  if (gridType === 'hex') return hexDistance(0, 0, q, r);
  return Math.max(Math.abs(q), Math.abs(r));
}

// ─── Dungeon Generator ────────────────────────────────

type HexRoom = { cq: number; cr: number; roomRadius: number };

function roomsOverlap(a: HexRoom, b: HexRoom, padding: number, gridType: GridType): boolean {
  const d = gridType === 'hex'
    ? hexDistance(a.cq, a.cr, b.cq, b.cr)
    : Math.max(Math.abs(a.cq - b.cq), Math.abs(a.cr - b.cr));
  return d < a.roomRadius + b.roomRadius + padding;
}

function generateDungeon(
  rng: () => number, radius: number, gridType: GridType
): { cells: TerrainCell[]; spawnZones: SpawnZone[]; props: PropDefinition[] } {
  const cellMap = new Map<string, TerrainCell>();

  for (const { q, r } of getAllCells(radius, gridType)) {
    cellMap.set(coordKey(q, r), { q, r, terrain: ['blocked'], propId: 'wall' });
  }

  const numRooms = randInt(rng, 3, 6);
  const rooms: HexRoom[] = [];
  let attempts = 0;
  const innerRadius = radius - 2;

  while (rooms.length < numRooms && attempts < 300) {
    attempts++;
    const roomRadius = randInt(rng, 2, 3);
    const cq = randInt(rng, -innerRadius + roomRadius, innerRadius - roomRadius);
    const cr = randInt(rng, -innerRadius + roomRadius, innerRadius - roomRadius);
    if (distFromCenter(cq, cr, gridType) + roomRadius > innerRadius) continue;

    const room: HexRoom = { cq, cr, roomRadius };
    if (rooms.some(r => roomsOverlap(r, room, 2, gridType))) continue;
    rooms.push(room);

    for (const { q, r } of getAllCells(radius, gridType)) {
      if (distFromCenter(q - cq, r - cr, gridType) <= roomRadius) {
        cellMap.set(coordKey(q, r), { q, r, terrain: [] });
      }
    }
  }

  for (let i = 0; i < rooms.length - 1; i++) {
    const a = rooms[i];
    const b = rooms[i + 1];
    let cq = a.cq;
    let cr = a.cr;
    while (cq !== b.cq || cr !== b.cr) {
      if (cq !== b.cq) cq += cq < b.cq ? 1 : -1;
      else cr += cr < b.cr ? 1 : -1;
      const key = coordKey(cq, cr);
      if (cellMap.get(key)?.terrain.includes('blocked')) {
        cellMap.set(key, { q: cq, r: cr, terrain: [] });
      }
    }
  }

  for (const room of rooms) {
    if (room.roomRadius >= 2 && rng() < 0.7) {
      const pq = room.cq + randInt(rng, -1, 1);
      const pr = room.cr + randInt(rng, -1, 1);
      if (pq !== room.cq || pr !== room.cr) {
        const key = coordKey(pq, pr);
        if (cellMap.has(key)) {
          const propId = rng() < 0.5 ? 'pillar' : 'crate';
          cellMap.set(key, { q: pq, r: pr, terrain: ['cover'], propId });
        }
      }
    }
  }

  for (const [key, cell] of cellMap) {
    if (cell.terrain.length === 0 && !cell.propId && rng() < 0.05) {
      cellMap.set(key, { ...cell, terrain: ['difficult'] });
    }
  }

  const firstRoom = rooms[0];
  const lastRoom = rooms[rooms.length - 1];
  const playerSpawns: { q: number; r: number }[] = [];
  const enemySpawns: { q: number; r: number }[] = [];

  if (firstRoom && lastRoom) {
    for (const { q, r } of getAllCells(radius, gridType)) {
      if (playerSpawns.length >= 4) break;
      if (distFromCenter(q - firstRoom.cq, r - firstRoom.cr, gridType) <= 1) {
        const cell = cellMap.get(coordKey(q, r));
        if (cell && !cell.terrain.includes('blocked') && !cell.terrain.includes('cover')) {
          playerSpawns.push({ q, r });
        }
      }
    }
    for (const { q, r } of getAllCells(radius, gridType)) {
      if (enemySpawns.length >= 4) break;
      if (distFromCenter(q - lastRoom.cq, r - lastRoom.cr, gridType) <= 1) {
        const cell = cellMap.get(coordKey(q, r));
        if (cell && !cell.terrain.includes('blocked') && !cell.terrain.includes('cover')) {
          enemySpawns.push({ q, r });
        }
      }
    }
  }

  const propIds = new Set<string>();
  for (const cell of cellMap.values()) {
    if (cell.propId) propIds.add(cell.propId);
  }
  const props: PropDefinition[] = [];
  for (const id of propIds) {
    props.push({ id, model: `${id}.glb` });
  }

  return {
    cells: Array.from(cellMap.values()),
    spawnZones: [
      { team: 'player', cells: playerSpawns },
      { team: 'enemy', cells: enemySpawns },
    ],
    props,
  };
}

// ─── Wilderness Generator ─────────────────────────────

function generateWilderness(
  rng: () => number, radius: number, gridType: GridType
): { cells: TerrainCell[]; spawnZones: SpawnZone[]; props: PropDefinition[] } {
  const cellMap = new Map<string, TerrainCell>();
  const allCells = getAllCells(radius, gridType);

  for (const { q, r } of allCells) {
    cellMap.set(coordKey(q, r), { q, r, terrain: [] });
  }

  for (const { q, r } of allCells) {
    const edge = isEdgeCell(q, r, radius, gridType);
    const nearEdge = isNearEdgeCell(q, r, radius, gridType);

    if (edge && rng() < 0.8) {
      const treeId = rng() < 0.5 ? 'tree_01' : 'tree_02';
      cellMap.set(coordKey(q, r), {
        q, r, terrain: ['blocked'], propId: treeId,
        propRotation: rng() * Math.PI * 2,
      });
    } else if (nearEdge && rng() < 0.3) {
      const treeId = rng() < 0.5 ? 'tree_01' : 'tree_02';
      cellMap.set(coordKey(q, r), {
        q, r, terrain: ['blocked'], propId: treeId,
        propRotation: rng() * Math.PI * 2,
      });
    }
  }

  const innerThreshold = radius * 0.3;
  for (const { q, r } of allCells) {
    const d = distFromCenter(q, r, gridType);
    if (d <= 1 || d >= radius - 1) continue;
    const cell = cellMap.get(coordKey(q, r));
    if (!cell || cell.terrain.includes('blocked')) continue;

    const isCenter = d < innerThreshold;
    if (!isCenter && rng() < 0.04) {
      const rockId = rng() < 0.5 ? 'rock_01' : 'rock_02';
      cellMap.set(coordKey(q, r), {
        q, r, terrain: ['cover'], propId: rockId,
        propRotation: rng() * Math.PI * 2,
      });
    } else if (rng() < 0.06) {
      cellMap.set(coordKey(q, r), {
        q, r, terrain: ['difficult'], propId: 'bush',
        propRotation: rng() * Math.PI * 2,
      });
    }
  }

  const playerSpawns: { q: number; r: number }[] = [];
  const enemySpawns: { q: number; r: number }[] = [];
  const spawnBand = Math.floor(radius * 0.6);

  for (const { q, r } of allCells) {
    if (playerSpawns.length >= 6 && enemySpawns.length >= 6) break;
    const cell = cellMap.get(coordKey(q, r));
    if (!cell || cell.terrain.includes('blocked')) continue;

    if (q <= -spawnBand && Math.abs(r) <= 2 && playerSpawns.length < 6) {
      playerSpawns.push({ q, r });
    }
    if (q >= spawnBand && Math.abs(r) <= 2 && enemySpawns.length < 6) {
      enemySpawns.push({ q, r });
    }
  }

  const propIds = new Set<string>();
  for (const cell of cellMap.values()) {
    if (cell.propId) propIds.add(cell.propId);
  }
  const props: PropDefinition[] = [];
  for (const id of propIds) {
    props.push({ id, model: `${id}.glb` });
  }

  return {
    cells: Array.from(cellMap.values()),
    spawnZones: [
      { team: 'player', cells: playerSpawns },
      { team: 'enemy', cells: enemySpawns },
    ],
    props,
  };
}

// ─── Public API ───────────────────────────────────────

export function generateMap(
  biome: BiomeId,
  options: GeneratorOptions,
): MapDefinition {
  const rng = mulberry32(options.seed);
  const radius = options.radius ?? (biome === 'dungeon' ? 10 : 9);

  const result = biome === 'dungeon'
    ? generateDungeon(rng, radius, options.gridType)
    : generateWilderness(rng, radius, options.gridType);

  const diameter = radius * 2 + 1;
  return {
    id: `${biome}-${options.seed}`,
    biome,
    seed: options.seed,
    width: diameter,
    height: diameter,
    cells: result.cells,
    spawnZones: result.spawnZones,
    props: result.props,
  };
}
