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

function getCellsOnLine(q0: number, r0: number, q1: number, r1: number): { q: number; r: number }[] {
  const cells: { q: number; r: number }[] = [];
  const dq = q1 - q0;
  const dr = r1 - r0;
  const steps = Math.max(Math.abs(dq), Math.abs(dr));
  if (steps === 0) return cells;

  const stepQ = dq / steps;
  const stepR = dr / steps;

  for (let i = 1; i < steps; i++) {
    const fq = q0 + stepQ * i;
    const fr = r0 + stepR * i;
    const rq = Math.round(fq);
    const rr = Math.round(fr);
    if (rq === q0 && rr === r0) continue;
    if (rq === q1 && rr === r1) continue;
    cells.push({ q: rq, r: rr });
  }
  return cells;
}

export function hasLineOfSight(
  map: MapDefinition | undefined,
  fromQ: number, fromR: number,
  toQ: number, toR: number
): boolean {
  if (!map) return true;
  const cells = getCellsOnLine(fromQ, fromR, toQ, toR);
  return !cells.some(c => isBlocked(map, c.q, c.r));
}
