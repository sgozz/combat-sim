export type GridType = 'hex' | 'square';

export type GridCoord = {
  q: number;
  r: number;
};

export type WorldPosition = {
  x: number;
  z: number;
};

export interface GridSystem {
  readonly type: GridType;
  readonly directions: number;
  readonly size: number;

  distance(a: GridCoord, b: GridCoord): number;
  neighbors(coord: GridCoord): GridCoord[];
  getNeighborInDirection(coord: GridCoord, direction: number): GridCoord;
  coordToWorld(coord: GridCoord): WorldPosition;
  worldToCoord(pos: WorldPosition): GridCoord;
  normalizeDirection(direction: number): number;
  getDirectionTo(from: GridCoord, to: GridCoord): number | null;
}

export type ReachableCell = {
  coord: GridCoord;
  cost: number;
  finalFacing: number;
};

export type MovementState = {
  startPosition: GridCoord;
  startFacing: number;
  currentPosition: GridCoord;
  currentFacing: number;
  movePointsRemaining: number;
  freeRotationUsed: boolean;
  movedBackward: boolean;
  phase: 'not_started' | 'moving' | 'completed';
};
