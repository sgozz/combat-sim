import type { BiomeId, MapDefinition, TerrainCell, SpawnZone, PropDefinition, TerrainProperty } from './types';
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
    if (room.roomRadius >= 3 && rng() < 0.5) {
      const key = coordKey(room.cq, room.cr);
      if (cellMap.has(key)) {
        cellMap.set(key, { q: room.cq, r: room.cr, terrain: ['cover'], propId: 'pillar' });
      }
    } else {
      const roomCells: TerrainCell[] = [];
      for (const { q, r } of getAllCells(radius, gridType)) {
        if (distFromCenter(q - room.cq, r - room.cr, gridType) <= room.roomRadius) {
          const key = coordKey(q, r);
          const cell = cellMap.get(key);
          if (cell && !cell.terrain.includes('blocked')) {
            roomCells.push(cell);
          }
        }
      }

      for (const cell of roomCells) {
        if (cell.q === room.cq && cell.r === room.cr) continue;
        if (rng() < 0.15) {
          const propRoll = rng();
          let propId = 'crate';
          let terrain: TerrainProperty[] = ['cover'];
          let rotation = rng() * Math.PI * 2;

          if (propRoll < 0.3) { propId = 'barrel'; }
          else if (propRoll < 0.4) { propId = 'barrel_damaged'; }
          else if (propRoll < 0.6) { propId = 'chair'; terrain = ['difficult']; }
          else if (propRoll < 0.7) { propId = 'table'; terrain = ['cover', 'difficult']; rotation = 0; }
          else if (propRoll < 0.8) { propId = 'brazier'; terrain = ['difficult']; }
          else if (propRoll < 0.9) { propId = 'bookshelf'; terrain = ['cover', 'blocked']; rotation = Math.floor(rng() * 4) * (Math.PI / 2); }
          else { propId = 'torch_wall'; terrain = []; }

          cellMap.set(coordKey(cell.q, cell.r), { ...cell, propId, terrain, propRotation: rotation });
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
      const roll = rng();
      const treeId = roll < 0.4 ? 'tree_01' : roll < 0.8 ? 'tree_02' : 'trunk';
      const terrain: TerrainProperty[] = treeId === 'trunk' ? ['cover', 'difficult'] : ['blocked'];
      cellMap.set(coordKey(q, r), {
        q, r, terrain, propId: treeId,
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
    if (!isCenter && rng() < 0.05) {
      const rockRoll = rng();
      let rockId = 'rock_01';
      if (rockRoll < 0.33) rockId = 'rock_02';
      else if (rockRoll < 0.66) rockId = 'stump';
      
      const terrain: TerrainProperty[] = rockId === 'stump' ? ['difficult'] : ['cover'];
      
      cellMap.set(coordKey(q, r), {
        q, r, terrain, propId: rockId,
        propRotation: rng() * Math.PI * 2,
      });
    } else if (rng() < 0.1) {
      const decoRoll = rng();
      let decoId = 'bush';
      let terrain: TerrainProperty[] = ['difficult'];
      
      if (decoRoll < 0.4) { decoId = 'grass'; terrain = []; }
      else if (decoRoll < 0.6) { decoId = 'flower_purple'; terrain = []; }
      else if (decoRoll < 0.8) { decoId = 'mushroom_red'; terrain = []; }
      
      cellMap.set(coordKey(q, r), {
        q, r, terrain, propId: decoId,
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

function generateDesert(
  rng: () => number, radius: number, gridType: GridType
): { cells: TerrainCell[]; spawnZones: SpawnZone[]; props: PropDefinition[] } {
  const cellMap = new Map<string, TerrainCell>();
  const allCells = getAllCells(radius, gridType);

  for (const { q, r } of allCells) {
    cellMap.set(coordKey(q, r), { q, r, terrain: [] });
  }

  for (const { q, r } of allCells) {
    const d = distFromCenter(q, r, gridType);
    if (d >= radius - 1) { 
      if (rng() < 0.4) {
        cellMap.set(coordKey(q, r), {
          q, r, terrain: ['blocked'], propId: 'rock_sand',
          propRotation: rng() * Math.PI * 2,
        });
      }
      continue;
    }

    if (d <= 1) continue; 

    if (rng() < 0.08) {
      const roll = rng();
      let propId = 'cactus_short';
      let terrain: TerrainProperty[] = ['difficult'];
      
      if (roll < 0.3) { propId = 'cactus_tall'; terrain = ['blocked']; }
      else if (roll < 0.6) { propId = 'rock_sand'; terrain = ['cover']; }
      
      cellMap.set(coordKey(q, r), {
        q, r, terrain, propId,
        propRotation: rng() * Math.PI * 2,
      });
    } else if (rng() < 0.05) {
      const decoRoll = rng();
      let decoId = 'dead_bush';
      let terrain: TerrainProperty[] = ['difficult'];
      
      if (decoRoll < 0.3) { decoId = 'bones'; terrain = []; }
      
      cellMap.set(coordKey(q, r), {
        q, r, terrain, propId: decoId,
        propRotation: rng() * Math.PI * 2,
      });
    }
  }

  const playerSpawns: { q: number; r: number }[] = [];
  const enemySpawns: { q: number; r: number }[] = [];
  const spawnBand = Math.floor(radius * 0.7);

  for (const { q, r } of allCells) {
    if (playerSpawns.length >= 6 && enemySpawns.length >= 6) break;
    const cell = cellMap.get(coordKey(q, r));
    if (!cell || cell.terrain.includes('blocked')) continue;

    if (q <= -spawnBand && r >= 0 && playerSpawns.length < 6) {
      playerSpawns.push({ q, r });
    }
    if (q >= spawnBand && r <= 0 && enemySpawns.length < 6) {
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

function generateGraveyard(
  rng: () => number, radius: number, gridType: GridType
): { cells: TerrainCell[]; spawnZones: SpawnZone[]; props: PropDefinition[] } {
  const cellMap = new Map<string, TerrainCell>();
  const allCells = getAllCells(radius, gridType);

  for (const { q, r } of allCells) {
    cellMap.set(coordKey(q, r), { q, r, terrain: [] });
  }

  const edgeCells = allCells.filter(c => isEdgeCell(c.q, c.r, radius, gridType));
  for (const { q, r } of edgeCells) {
    if (rng() < 0.9) { 
      cellMap.set(coordKey(q, r), {
        q, r, terrain: ['blocked'], propId: 'fence_iron',
        propRotation: Math.atan2(r, q), 
      });
    }
  }

  for (const { q, r } of allCells) {
    if (isEdgeCell(q, r, radius, gridType) || distFromCenter(q, r, gridType) <= 1) continue;
    
    if (rng() < 0.12) {
      const roll = rng();
      let propId = 'gravestone_1';
      let terrain: TerrainProperty[] = ['cover'];
      
      if (roll < 0.4) propId = 'gravestone_2';
      else if (roll < 0.5) { propId = 'tomb'; terrain = ['blocked', 'cover']; }
      else if (roll < 0.6) { propId = 'tree_dead'; terrain = ['blocked']; }
      else if (roll < 0.65) { propId = 'lantern'; terrain = []; }
      
      cellMap.set(coordKey(q, r), {
        q, r, terrain, propId,
        propRotation: rng() * Math.PI * 2,
      });
    } else if (rng() < 0.05) {
      cellMap.set(coordKey(q, r), {
        q, r, terrain: ['difficult'], propId: 'dead_bush',
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

    if (r >= spawnBand && Math.abs(q) <= 2 && playerSpawns.length < 6) {
      playerSpawns.push({ q, r });
    }
    if (r <= -spawnBand && Math.abs(q) <= 2 && enemySpawns.length < 6) {
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

  let result;
  switch (biome) {
    case 'dungeon':
      result = generateDungeon(rng, radius, options.gridType);
      break;
    case 'desert':
      result = generateDesert(rng, radius, options.gridType);
      break;
    case 'graveyard':
      result = generateGraveyard(rng, radius, options.gridType);
      break;
    case 'wilderness':
    default:
      result = generateWilderness(rng, radius, options.gridType);
      break;
  }

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
