import { hexToWorld } from '../../utils/hex'
import type { GridPosition } from '../../../shared/types'

export const MoveMarker = ({ position }: { position: GridPosition }) => {
  const [x, z] = hexToWorld(position.x, position.z)
  return (
    <mesh position={[x, 0.05, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.5, 0.7, 6]} />
      <meshBasicMaterial color="#4f4" transparent opacity={0.8} />
    </mesh>
  )
}
