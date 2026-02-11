import type { GridSystem, GridCoord, WorldPosition } from './types';

const SQUARE_SIZE = 1;

const SQUARE_DIRECTIONS_4: GridCoord[] = [
  { q: 0, r: -1 },
  { q: 1, r: 0 },
  { q: 0, r: 1 },
  { q: -1, r: 0 },
];

const SQUARE_DIRECTIONS_8: GridCoord[] = [
  { q: 0, r: -1 },
  { q: 1, r: -1 },
  { q: 1, r: 0 },
  { q: 1, r: 1 },
  { q: 0, r: 1 },
  { q: -1, r: 1 },
  { q: -1, r: 0 },
  { q: -1, r: -1 },
];

export class SquareGridSystem implements GridSystem {
  readonly type = 'square' as const;
  readonly directions: 4 | 8;
  readonly size = SQUARE_SIZE;

  private readonly directionVectors: GridCoord[];

  constructor(directions: 4 | 8 = 8) {
    this.directions = directions;
    this.directionVectors = directions === 4 ? SQUARE_DIRECTIONS_4 : SQUARE_DIRECTIONS_8;
  }

  distance(a: GridCoord, b: GridCoord): number {
    const dq = Math.abs(a.q - b.q);
    const dr = Math.abs(a.r - b.r);
    
    if (this.directions === 4) {
      return dq + dr;
    }
    return Math.max(dq, dr);
  }

  isInBurst(center: GridCoord, target: GridCoord, radius: number): boolean {
    const dq = center.q - target.q;
    const dr = center.r - target.r;
    return dq * dq + dr * dr <= (radius + 0.5) * (radius + 0.5);
  }

  neighbors(coord: GridCoord): GridCoord[] {
    return this.directionVectors.map(d => ({
      q: coord.q + d.q,
      r: coord.r + d.r,
    }));
  }

  getNeighborInDirection(coord: GridCoord, direction: number): GridCoord {
    const d = this.directionVectors[this.normalizeDirection(direction)];
    return { q: coord.q + d.q, r: coord.r + d.r };
  }

  coordToWorld(coord: GridCoord): WorldPosition {
    return {
      x: coord.q * SQUARE_SIZE,
      z: coord.r * SQUARE_SIZE,
    };
  }

  worldToCoord(pos: WorldPosition): GridCoord {
    return {
      q: Math.round(pos.x / SQUARE_SIZE),
      r: Math.round(pos.z / SQUARE_SIZE),
    };
  }

  normalizeDirection(direction: number): number {
    const n = this.directions;
    return ((direction % n) + n) % n;
  }

  getDirectionTo(from: GridCoord, to: GridCoord): number | null {
    const dq = Math.sign(to.q - from.q);
    const dr = Math.sign(to.r - from.r);

    for (let i = 0; i < this.directionVectors.length; i++) {
      const d = this.directionVectors[i];
      if (d.q === dq && d.r === dr) {
        return i;
      }
    }

    if (dq === 0 && dr === 0) {
      return null;
    }

    for (let i = 0; i < this.directionVectors.length; i++) {
      const d = this.directionVectors[i];
      if ((dq === 0 || d.q === dq) && (dr === 0 || d.r === dr)) {
        return i;
      }
    }

    return null;
  }
}

export const squareGrid4 = new SquareGridSystem(4);
export const squareGrid8 = new SquareGridSystem(8);
