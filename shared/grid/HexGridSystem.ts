import type { GridSystem, GridCoord, WorldPosition } from './types';

const HEX_SIZE = 1;
const SQRT3 = Math.sqrt(3);

const HEX_DIRECTIONS: GridCoord[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

export class HexGridSystem implements GridSystem {
  readonly type = 'hex' as const;
  readonly directions = 6;
  readonly size = HEX_SIZE;

  distance(a: GridCoord, b: GridCoord): number {
    return (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2;
  }

  neighbors(coord: GridCoord): GridCoord[] {
    return HEX_DIRECTIONS.map(d => ({
      q: coord.q + d.q,
      r: coord.r + d.r,
    }));
  }

  getNeighborInDirection(coord: GridCoord, direction: number): GridCoord {
    const d = HEX_DIRECTIONS[this.normalizeDirection(direction)];
    return { q: coord.q + d.q, r: coord.r + d.r };
  }

  coordToWorld(coord: GridCoord): WorldPosition {
    return {
      x: HEX_SIZE * (SQRT3 * (coord.q + coord.r / 2)),
      z: HEX_SIZE * (1.5 * coord.r),
    };
  }

  worldToCoord(pos: WorldPosition): GridCoord {
    const q = (SQRT3 / 3 * pos.x - 1 / 3 * pos.z) / HEX_SIZE;
    const r = (2 / 3 * pos.z) / HEX_SIZE;

    const cubeX = q;
    const cubeZ = r;
    const cubeY = -cubeX - cubeZ;

    let rx = Math.round(cubeX);
    let ry = Math.round(cubeY);
    let rz = Math.round(cubeZ);

    const xDiff = Math.abs(rx - cubeX);
    const yDiff = Math.abs(ry - cubeY);
    const zDiff = Math.abs(rz - cubeZ);

    if (xDiff > yDiff && xDiff > zDiff) {
      rx = -ry - rz;
    } else if (yDiff > zDiff) {
      ry = -rx - rz;
    } else {
      rz = -rx - ry;
    }

    return { q: rx, r: rz };
  }

  normalizeDirection(direction: number): number {
    return ((direction % 6) + 6) % 6;
  }

  getDirectionTo(from: GridCoord, to: GridCoord): number | null {
    const dq = to.q - from.q;
    const dr = to.r - from.r;

    for (let i = 0; i < HEX_DIRECTIONS.length; i++) {
      if (HEX_DIRECTIONS[i].q === dq && HEX_DIRECTIONS[i].r === dr) {
        return i;
      }
    }
    return null;
  }
}

export const hexGrid = new HexGridSystem();
