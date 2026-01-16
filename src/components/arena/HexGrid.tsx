import { useMemo, useState } from 'react'
import { Text, Billboard } from '@react-three/drei'
import { HEX_SIZE, hexToWorld, hexDistance } from '../../utils/hex'
import type { GridPosition } from '../../../shared/types'

type HexGridProps = {
  radius: number
  playerPosition: GridPosition | null
  moveRange: number
  attackRange: number
  isPlayerTurn: boolean
  enemyPositions: GridPosition[]
  selectedTargetPosition: GridPosition | null
  moveTargetPosition: GridPosition | null
  frontArcHexes: { q: number; r: number }[]
  onHexClick: (q: number, r: number) => void
}

const getHexColor = (
  q: number,
  r: number,
  playerPosition: GridPosition | null,
  moveRange: number,
  attackRange: number,
  isPlayerTurn: boolean,
  enemyPositions: GridPosition[],
  selectedTargetPosition: GridPosition | null,
  moveTargetPosition: GridPosition | null,
  isFrontArc: boolean,
  isAlternate: boolean,
  isHovered: boolean
): string => {
  if (moveTargetPosition && moveTargetPosition.x === q && moveTargetPosition.z === r) {
    return '#00ff00'
  }
  
  if (selectedTargetPosition && selectedTargetPosition.x === q && selectedTargetPosition.z === r) {
    return '#ffcc00'
  }
  
  const isEnemy = enemyPositions.some(pos => pos.x === q && pos.z === r)
  if (isEnemy) {
    if (isPlayerTurn && playerPosition) {
      const distance = hexDistance(q, r, playerPosition.x, playerPosition.z)
      if (distance <= attackRange) {
        return isHovered ? '#cc4444' : '#aa2222'
      }
    }
    // Enemy out of range or not player turn - dimmed red
    return isHovered ? '#882222' : '#661111'
  }
  
  if (playerPosition) {
    const distance = hexDistance(q, r, playerPosition.x, playerPosition.z)
    
    // Player's own hex
    if (distance === 0) {
       return isAlternate ? '#1a1a1a' : '#252525'
    }

    if (isPlayerTurn) {
      if (distance <= moveRange) {
        return isHovered ? '#448844' : '#224422'
      } else {
        // Out of move range - dim it
        return isHovered ? '#333333' : '#1a1a1a'
      }
    }
  }

  if (isHovered) {
    return '#444444'
  }

  if (isFrontArc) {
    return isAlternate ? '#2a2a2a' : '#333333'
  }
  
  return isAlternate ? '#1a1a1a' : '#252525'
}

const HexTile = ({ q, r, color, onClick, onHover, onUnhover }: { 
  q: number; 
  r: number; 
  color: string; 
  onClick: () => void;
  onHover: () => void;
  onUnhover: () => void;
}) => {
  const [x, z] = hexToWorld(q, r)
  return (
    <mesh 
      position={[x, -0.05, z]} 
      onClick={(e) => { e.stopPropagation(); onClick() }}
      onPointerOver={(e) => { e.stopPropagation(); onHover() }}
      onPointerOut={(e) => { e.stopPropagation(); onUnhover() }}
    >
      <cylinderGeometry args={[HEX_SIZE, HEX_SIZE, 0.1, 6]} />
      <meshStandardMaterial color={color} />
    </mesh>
  )
}

export const HexGrid = ({ radius, playerPosition, moveRange, attackRange, isPlayerTurn, enemyPositions, selectedTargetPosition, moveTargetPosition, frontArcHexes, onHexClick }: HexGridProps) => {
  const [hoveredHex, setHoveredHex] = useState<{q: number, r: number} | null>(null)

  const tiles = useMemo(() => {
    const result: { q: number; r: number }[] = []
    for (let q = -radius; q <= radius; q += 1) {
      for (let r = -radius; r <= radius; r += 1) {
        if (Math.abs(q + r) > radius) continue
        result.push({ q, r })
      }
    }
    return result
  }, [radius])

  const hoverInfo = useMemo(() => {
    if (!hoveredHex || !playerPosition || !isPlayerTurn) return null
    
    const dist = hexDistance(hoveredHex.q, hoveredHex.r, playerPosition.x, playerPosition.z)
    const isReachable = dist <= moveRange
    const color = isReachable ? '#44ff44' : '#ff4444'
    const [x, z] = hexToWorld(hoveredHex.q, hoveredHex.r)
    
    return { dist, color, position: [x, 0.5, z] as [number, number, number] }
  }, [hoveredHex, playerPosition, isPlayerTurn, moveRange])

  return (
    <group>
      {hoverInfo && (
        <Billboard position={hoverInfo.position}>
          <Text
            fontSize={0.6}
            color={hoverInfo.color}
            outlineWidth={0.05}
            outlineColor="#000000"
            anchorY="middle"
          >
            {hoverInfo.dist}
          </Text>
        </Billboard>
      )}
      {tiles.map(({ q, r }) => {
        const isAlternate = (q + r) % 2 === 0
        const isHovered = hoveredHex?.q === q && hoveredHex?.r === r
        const isFrontArc = frontArcHexes.some(h => h.q === q && h.r === r)
        const color = getHexColor(q, r, playerPosition, moveRange, attackRange, isPlayerTurn, enemyPositions, selectedTargetPosition, moveTargetPosition, isFrontArc, isAlternate, isHovered)
        return (
          <HexTile 
            key={`${q},${r}`} 
            q={q} 
            r={r} 
            color={color} 
            onClick={() => onHexClick(q, r)}
            onHover={() => setHoveredHex({ q, r })}
            onUnhover={() => setHoveredHex(null)}
          />
        )
      })}
    </group>
  )
}
