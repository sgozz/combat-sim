import type { MapDefinition, TerrainCell } from './types';

export function getTerrainAt(map: MapDefinition | undefined, q: number, r: number): TerrainCell | null {
  if (!map) return null;
  return map.cells.find(c => c.q === q && c.r === r) ?? null;
}

export function isBlocked(map: MapDefinition | undefined, q: number, r: number): boolean {
  if (!map) return false;
  const cell = getTerrainAt(map, q, r);
  return cell?.terrain.includes('blocked') ?? false;
}

export function isDifficultTerrain(map: MapDefinition | undefined, q: number, r: number): boolean {
  if (!map) return false;
  const cell = getTerrainAt(map, q, r);
  return cell?.terrain.includes('difficult') ?? false;
}

export function hasCover(map: MapDefinition | undefined, q: number, r: number): boolean {
  if (!map) return false;
  const cell = getTerrainAt(map, q, r);
  return cell?.terrain.includes('cover') ?? false;
}

export function getMovementCost(map: MapDefinition | undefined, q: number, r: number): number {
  if (!map) return 1;
  if (isBlocked(map, q, r)) return Infinity;
  if (isDifficultTerrain(map, q, r)) return 2;
  return 1;
}
