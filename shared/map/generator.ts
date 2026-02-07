import type { BiomeId, MapDefinition, TerrainCell, SpawnZone, PropDefinition } from './types';
import type { GridType } from '../grid/types';

// Seeded PRNG — mulberry32 algorithm
function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

type Rect = { x: number; y: number; w: number; h: number };

type GeneratorOptions = {
  seed: number;
  gridType: GridType;
  width?: number;
  height?: number;
};

// ─── Helpers ───────────────────────────────────────────

function coordKey(q: number, r: number): string {
  return `${q},${r}`;
}

function randInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function rectsOverlap(a: Rect, b: Rect, padding = 1): boolean {
  return !(
    a.x + a.w + padding <= b.x ||
    b.x + b.w + padding <= a.x ||
    a.y + a.h + padding <= b.y ||
    b.y + b.h + padding <= a.y
  );
}

// ─── Dungeon Generator ────────────────────────────────

function generateDungeon(rng: () => number, width: number, height: number): {
  cells: TerrainCell[];
  spawnZones: SpawnZone[];
  props: PropDefinition[];
} {
  const cellMap = new Map<string, TerrainCell>();

  // Initialize all cells as blocked (walls)
  for (let q = 0; q < width; q++) {
    for (let r = 0; r < height; r++) {
      cellMap.set(coordKey(q, r), {
        q, r,
        terrain: ['blocked'],
        propId: 'wall',
      });
    }
  }

  // Place rooms
  const numRooms = randInt(rng, 3, 6);
  const rooms: Rect[] = [];
  let attempts = 0;

  while (rooms.length < numRooms && attempts < 200) {
    attempts++;
    const w = randInt(rng, 3, 6);
    const h = randInt(rng, 3, 6);
    const x = randInt(rng, 1, width - w - 1);
    const y = randInt(rng, 1, height - h - 1);
    const room: Rect = { x, y, w, h };

    if (rooms.some(r => rectsOverlap(r, room, 2))) continue;
    rooms.push(room);

    // Carve room interior
    for (let rq = x; rq < x + w; rq++) {
      for (let rr = y; rr < y + h; rr++) {
        cellMap.set(coordKey(rq, rr), { q: rq, r: rr, terrain: [] });
      }
    }
  }

  // Connect rooms with L-shaped corridors
  for (let i = 0; i < rooms.length - 1; i++) {
    const a = rooms[i];
    const b = rooms[i + 1];
    const ax = Math.floor(a.x + a.w / 2);
    const ay = Math.floor(a.y + a.h / 2);
    const bx = Math.floor(b.x + b.w / 2);
    const by = Math.floor(b.y + b.h / 2);

    // Horizontal then vertical
    const startX = Math.min(ax, bx);
    const endX = Math.max(ax, bx);
    for (let q = startX; q <= endX; q++) {
      const key = coordKey(q, ay);
      if (cellMap.get(key)?.terrain.includes('blocked')) {
        cellMap.set(key, { q, r: ay, terrain: [] });
      }
    }

    const startY = Math.min(ay, by);
    const endY = Math.max(ay, by);
    for (let r = startY; r <= endY; r++) {
      const key = coordKey(bx, r);
      if (cellMap.get(key)?.terrain.includes('blocked')) {
        cellMap.set(key, { q: bx, r, terrain: [] });
      }
    }
  }

  // Add cover props inside rooms (pillars, crates)
  for (const room of rooms) {
    if (room.w >= 4 && room.h >= 4 && rng() < 0.7) {
      const propQ = randInt(rng, room.x + 1, room.x + room.w - 2);
      const propR = randInt(rng, room.y + 1, room.y + room.h - 2);
      const key = coordKey(propQ, propR);
      const propId = rng() < 0.5 ? 'pillar' : 'crate';
      cellMap.set(key, { q: propQ, r: propR, terrain: ['cover'], propId });
    }
  }

  // Add difficult terrain in some corridors
  for (const [key, cell] of cellMap) {
    if (cell.terrain.length === 0 && !cell.propId && rng() < 0.05) {
      cellMap.set(key, { ...cell, terrain: ['difficult'] });
    }
  }

  // Generate spawn zones from first and last rooms
  const firstRoom = rooms[0];
  const lastRoom = rooms[rooms.length - 1];

  const playerSpawns: { q: number; r: number }[] = [];
  const enemySpawns: { q: number; r: number }[] = [];

  if (firstRoom && lastRoom) {
    for (let q = firstRoom.x; q < firstRoom.x + firstRoom.w && playerSpawns.length < 4; q++) {
      for (let r = firstRoom.y; r < firstRoom.y + firstRoom.h && playerSpawns.length < 4; r++) {
        const cell = cellMap.get(coordKey(q, r));
        if (cell && !cell.terrain.includes('blocked') && !cell.terrain.includes('cover')) {
          playerSpawns.push({ q, r });
        }
      }
    }

    for (let q = lastRoom.x; q < lastRoom.x + lastRoom.w && enemySpawns.length < 4; q++) {
      for (let r = lastRoom.y; r < lastRoom.y + lastRoom.h && enemySpawns.length < 4; r++) {
        const cell = cellMap.get(coordKey(q, r));
        if (cell && !cell.terrain.includes('blocked') && !cell.terrain.includes('cover')) {
          enemySpawns.push({ q, r });
        }
      }
    }
  }

  const spawnZones: SpawnZone[] = [
    { team: 'player', cells: playerSpawns },
    { team: 'enemy', cells: enemySpawns },
  ];

  // Collect unique props
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
    spawnZones,
    props,
  };
}

// ─── Wilderness Generator ─────────────────────────────

function generateWilderness(rng: () => number, width: number, height: number): {
  cells: TerrainCell[];
  spawnZones: SpawnZone[];
  props: PropDefinition[];
} {
  const cellMap = new Map<string, TerrainCell>();

  // Initialize all cells as open
  for (let q = 0; q < width; q++) {
    for (let r = 0; r < height; r++) {
      cellMap.set(coordKey(q, r), { q, r, terrain: [] });
    }
  }

  // Add tree line around perimeter
  for (let q = 0; q < width; q++) {
    for (let r = 0; r < height; r++) {
      const isEdge = q === 0 || q === width - 1 || r === 0 || r === height - 1;
      const isNearEdge = q === 1 || q === width - 2 || r === 1 || r === height - 2;

      if (isEdge && rng() < 0.8) {
        const treeId = rng() < 0.5 ? 'tree_01' : 'tree_02';
        cellMap.set(coordKey(q, r), {
          q, r,
          terrain: ['blocked'],
          propId: treeId,
          propRotation: rng() * Math.PI * 2,
        });
      } else if (isNearEdge && rng() < 0.3) {
        const treeId = rng() < 0.5 ? 'tree_01' : 'tree_02';
        cellMap.set(coordKey(q, r), {
          q, r,
          terrain: ['blocked'],
          propId: treeId,
          propRotation: rng() * Math.PI * 2,
        });
      }
    }
  }

  // Scatter rocks in the field (not in center 40%)
  const centerMinQ = Math.floor(width * 0.3);
  const centerMaxQ = Math.floor(width * 0.7);
  const centerMinR = Math.floor(height * 0.3);
  const centerMaxR = Math.floor(height * 0.7);

  for (let q = 2; q < width - 2; q++) {
    for (let r = 2; r < height - 2; r++) {
      const isCenter = q >= centerMinQ && q <= centerMaxQ && r >= centerMinR && r <= centerMaxR;
      const cell = cellMap.get(coordKey(q, r));
      if (!cell || cell.terrain.includes('blocked')) continue;

      if (!isCenter && rng() < 0.04) {
        const rockId = rng() < 0.5 ? 'rock_01' : 'rock_02';
        cellMap.set(coordKey(q, r), {
          q, r,
          terrain: ['cover'],
          propId: rockId,
          propRotation: rng() * Math.PI * 2,
        });
      } else if (rng() < 0.06) {
        cellMap.set(coordKey(q, r), {
          q, r,
          terrain: ['difficult'],
          propId: 'bush',
          propRotation: rng() * Math.PI * 2,
        });
      }
    }
  }

  // Spawn zones: player on left side, enemy on right side
  const playerSpawns: { q: number; r: number }[] = [];
  const enemySpawns: { q: number; r: number }[] = [];

  const midR = Math.floor(height / 2);
  for (let offset = -2; offset <= 2; offset++) {
    const r = midR + offset;
    if (r < 2 || r >= height - 2) continue;

    // Player spawns on left
    for (let q = 2; q < 5 && playerSpawns.length < 6; q++) {
      const cell = cellMap.get(coordKey(q, r));
      if (cell && !cell.terrain.includes('blocked')) {
        playerSpawns.push({ q, r });
      }
    }

    // Enemy spawns on right
    for (let q = width - 5; q < width - 2 && enemySpawns.length < 6; q++) {
      const cell = cellMap.get(coordKey(q, r));
      if (cell && !cell.terrain.includes('blocked')) {
        enemySpawns.push({ q, r });
      }
    }
  }

  const spawnZones: SpawnZone[] = [
    { team: 'player', cells: playerSpawns },
    { team: 'enemy', cells: enemySpawns },
  ];

  // Collect unique props
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
    spawnZones,
    props,
  };
}

// ─── Public API ───────────────────────────────────────

export function generateMap(
  biome: BiomeId,
  options: GeneratorOptions,
): MapDefinition {
  const rng = mulberry32(options.seed);
  const width = options.width ?? (biome === 'dungeon' ? 25 : 20);
  const height = options.height ?? (biome === 'dungeon' ? 25 : 20);

  const result = biome === 'dungeon'
    ? generateDungeon(rng, width, height)
    : generateWilderness(rng, width, height);

  return {
    id: `${biome}-${options.seed}`,
    biome,
    seed: options.seed,
    width,
    height,
    cells: result.cells,
    spawnZones: result.spawnZones,
    props: result.props,
  };
}
