import type { BiomeId, TerrainProperty } from '../../shared/map/types';

export type EnvironmentAsset = {
  id: string;
  path: string;
  scale: number;
  defaultTerrain: TerrainProperty[];
  biomes: BiomeId[];
};

export const ENVIRONMENT_ASSETS: Record<string, EnvironmentAsset> = {
  wall: {
    id: 'wall',
    path: '/models/environment/dungeon/wall.glb',
    scale: 1.0,
    defaultTerrain: ['blocked'],
    biomes: ['dungeon'],
  },
  wall_corner: {
    id: 'wall_corner',
    path: '/models/environment/dungeon/wall_corner.glb',
    scale: 1.0,
    defaultTerrain: ['blocked'],
    biomes: ['dungeon'],
  },
  floor: {
    id: 'floor',
    path: '/models/environment/dungeon/floor.glb',
    scale: 1.0,
    defaultTerrain: [],
    biomes: ['dungeon'],
  },
  pillar: {
    id: 'pillar',
    path: '/models/environment/dungeon/pillar.glb',
    scale: 1.0,
    defaultTerrain: ['cover'],
    biomes: ['dungeon'],
  },
  crate: {
    id: 'crate',
    path: '/models/environment/dungeon/crate.glb',
    scale: 0.8,
    defaultTerrain: ['cover'],
    biomes: ['dungeon'],
  },
  barrel: {
    id: 'barrel',
    path: '/models/environment/dungeon/barrel.glb',
    scale: 0.8,
    defaultTerrain: ['cover'],
    biomes: ['dungeon'],
  },
  barrel_damaged: {
    id: 'barrel_damaged',
    path: '/models/environment/dungeon/barrel_damaged.glb',
    scale: 0.8,
    defaultTerrain: ['cover'],
    biomes: ['dungeon'],
  },
  door: {
    id: 'door',
    path: '/models/environment/dungeon/door.glb',
    scale: 1.0,
    defaultTerrain: [],
    biomes: ['dungeon'],
  },
  table: {
    id: 'table',
    path: '/models/environment/dungeon/table.glb',
    scale: 1.0,
    defaultTerrain: ['difficult', 'cover'],
    biomes: ['dungeon'],
  },
  chair: {
    id: 'chair',
    path: '/models/environment/dungeon/chair.glb',
    scale: 0.8,
    defaultTerrain: ['difficult'],
    biomes: ['dungeon'],
  },
  bookshelf: {
    id: 'bookshelf',
    path: '/models/environment/dungeon/bookshelf.glb',
    scale: 1.0,
    defaultTerrain: ['blocked', 'cover'],
    biomes: ['dungeon'],
  },
  torch_wall: {
    id: 'torch_wall',
    path: '/models/environment/dungeon/torch_wall.glb',
    scale: 0.5,
    defaultTerrain: [],
    biomes: ['dungeon'],
  },
  brazier: {
    id: 'brazier',
    path: '/models/environment/dungeon/brazier.glb',
    scale: 0.8,
    defaultTerrain: ['difficult'],
    biomes: ['dungeon'],
  },
  banner: {
    id: 'banner',
    path: '/models/environment/dungeon/banner.glb',
    scale: 1.0,
    defaultTerrain: [],
    biomes: ['dungeon'],
  },

  tree_01: {
    id: 'tree_01',
    path: '/models/environment/wilderness/tree_01.glb',
    scale: 1.2,
    defaultTerrain: ['blocked'],
    biomes: ['wilderness'],
  },
  tree_02: {
    id: 'tree_02',
    path: '/models/environment/wilderness/tree_02.glb',
    scale: 1.0,
    defaultTerrain: ['blocked'],
    biomes: ['wilderness'],
  },
  rock_01: {
    id: 'rock_01',
    path: '/models/environment/wilderness/rock_01.glb',
    scale: 1.0,
    defaultTerrain: ['cover'],
    biomes: ['wilderness'],
  },
  rock_02: {
    id: 'rock_02',
    path: '/models/environment/wilderness/rock_02.glb',
    scale: 0.8,
    defaultTerrain: ['cover'],
    biomes: ['wilderness'],
  },
  bush: {
    id: 'bush',
    path: '/models/environment/wilderness/bush.glb',
    scale: 0.7,
    defaultTerrain: ['difficult'],
    biomes: ['wilderness'],
  },
  grass: {
    id: 'grass',
    path: '/models/environment/wilderness/grass.glb',
    scale: 0.5,
    defaultTerrain: [],
    biomes: ['wilderness'],
  },
  trunk: {
    id: 'trunk',
    path: '/models/environment/wilderness/trunk.glb',
    scale: 1.0,
    defaultTerrain: ['cover', 'difficult'],
    biomes: ['wilderness'],
  },
  stump: {
    id: 'stump',
    path: '/models/environment/wilderness/stump.glb',
    scale: 0.8,
    defaultTerrain: ['difficult'],
    biomes: ['wilderness'],
  },
  mushroom_red: {
    id: 'mushroom_red',
    path: '/models/environment/wilderness/mushroom_red.glb',
    scale: 0.5,
    defaultTerrain: [],
    biomes: ['wilderness'],
  },
  flower_purple: {
    id: 'flower_purple',
    path: '/models/environment/wilderness/flower_purple.glb',
    scale: 0.4,
    defaultTerrain: [],
    biomes: ['wilderness'],
  },

  cactus_tall: {
    id: 'cactus_tall',
    path: '/models/environment/desert/cactus_tall.glb',
    scale: 1.0,
    defaultTerrain: ['blocked'],
    biomes: ['desert'],
  },
  cactus_short: {
    id: 'cactus_short',
    path: '/models/environment/desert/cactus_short.glb',
    scale: 0.8,
    defaultTerrain: ['difficult'],
    biomes: ['desert'],
  },
  rock_sand: {
    id: 'rock_sand',
    path: '/models/environment/desert/rock_sand.glb',
    scale: 1.0,
    defaultTerrain: ['cover'],
    biomes: ['desert'],
  },
  bones: {
    id: 'bones',
    path: '/models/environment/desert/bones.glb',
    scale: 0.6,
    defaultTerrain: [],
    biomes: ['desert'],
  },
  dead_bush: {
    id: 'dead_bush',
    path: '/models/environment/desert/dead_bush.glb',
    scale: 0.7,
    defaultTerrain: ['difficult'],
    biomes: ['desert', 'graveyard'],
  },

  gravestone_1: {
    id: 'gravestone_1',
    path: '/models/environment/graveyard/gravestone_1.glb',
    scale: 0.8,
    defaultTerrain: ['cover'],
    biomes: ['graveyard'],
  },
  gravestone_2: {
    id: 'gravestone_2',
    path: '/models/environment/graveyard/gravestone_2.glb',
    scale: 0.8,
    defaultTerrain: ['cover'],
    biomes: ['graveyard'],
  },
  tomb: {
    id: 'tomb',
    path: '/models/environment/graveyard/tomb.glb',
    scale: 1.0,
    defaultTerrain: ['blocked', 'cover'],
    biomes: ['graveyard'],
  },
  tree_dead: {
    id: 'tree_dead',
    path: '/models/environment/graveyard/tree_dead.glb',
    scale: 1.1,
    defaultTerrain: ['blocked'],
    biomes: ['graveyard', 'desert'],
  },
  fence_iron: {
    id: 'fence_iron',
    path: '/models/environment/graveyard/fence_iron.glb',
    scale: 1.0,
    defaultTerrain: ['blocked'],
    biomes: ['graveyard'],
  },
  lantern: {
    id: 'lantern',
    path: '/models/environment/graveyard/lantern.glb',
    scale: 0.5,
    defaultTerrain: [],
    biomes: ['graveyard'],
  },
};

export const getAssetsForBiome = (biome: BiomeId): EnvironmentAsset[] =>
  Object.values(ENVIRONMENT_ASSETS).filter(a => a.biomes.includes(biome));

export const getAssetById = (id: string): EnvironmentAsset | undefined =>
  ENVIRONMENT_ASSETS[id];
