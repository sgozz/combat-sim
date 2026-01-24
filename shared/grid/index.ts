export type { GridSystem, GridCoord, WorldPosition, GridType, ReachableCell, MovementState } from './types';
export { HexGridSystem, hexGrid } from './HexGridSystem';
export { SquareGridSystem, squareGrid4, squareGrid8 } from './SquareGridSystem';

import type { GridSystem, GridType } from './types';
import { HexGridSystem } from './HexGridSystem';
import { SquareGridSystem } from './SquareGridSystem';

export const createGridSystem = (type: GridType): GridSystem => {
  switch (type) {
    case 'hex':
      return new HexGridSystem();
    case 'square':
      return new SquareGridSystem(8);
    default:
      return new HexGridSystem();
  }
};
