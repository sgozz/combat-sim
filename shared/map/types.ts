export type BiomeId = 'dungeon' | 'wilderness' | 'desert' | 'graveyard';

export type TerrainProperty = 'blocked' | 'difficult' | 'cover';

export type TerrainCell = {
  q: number;
  r: number;
  terrain: TerrainProperty[];
  propId?: string;
  propRotation?: number;
};

export type SpawnZone = {
  team: 'player' | 'enemy';
  cells: { q: number; r: number }[];
};

export type PropDefinition = {
  id: string;
  model: string;
  scale?: number;
};

export type MapDefinition = {
  id: string;
  biome: BiomeId;
  seed: number;
  width: number;
  height: number;
  cells: TerrainCell[];
  spawnZones: SpawnZone[];
  props: PropDefinition[];
};
