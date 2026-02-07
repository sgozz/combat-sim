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
  door: {
    id: 'door',
    path: '/models/environment/dungeon/door.glb',
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
};

export const getAssetsForBiome = (biome: BiomeId): EnvironmentAsset[] =>
  Object.values(ENVIRONMENT_ASSETS).filter(a => a.biomes.includes(biome));

export const getAssetById = (id: string): EnvironmentAsset | undefined =>
  ENVIRONMENT_ASSETS[id];
