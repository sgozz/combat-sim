import { useMemo } from 'react'
import type { GridSystem, GridType } from '../../../shared/grid'
import { hexGrid, squareGrid8 } from '../../../shared/grid'
import type { GridPosition } from '../../../shared/types'

const getGridSystem = (gridType: GridType): GridSystem => {
  return gridType === 'square' ? squareGrid8 : hexGrid
}

type MoveMarkerProps = {
  position: GridPosition
  gridType: GridType
}

export const MoveMarker = ({ position, gridType }: MoveMarkerProps) => {
  const gridSystem = useMemo(() => getGridSystem(gridType), [gridType])
  const worldPos = gridSystem.coordToWorld({ q: position.x, r: position.z })
  const sides = gridType === 'hex' ? 6 : 4
  return (
    <mesh position={[worldPos.x, 0.05, worldPos.z]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.5, 0.7, sides]} />
      <meshBasicMaterial color="#4f4" transparent opacity={0.8} />
    </mesh>
  )
}
