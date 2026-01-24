import { useMemo, useState } from 'react'
import { Text, Billboard } from '@react-three/drei'
import type { GridSystem, GridCoord, GridType } from '../../../shared/grid'
import { hexGrid, squareGrid8 } from '../../../shared/grid'
import type { GridPosition, ReachableHexInfo } from '../../../shared/types'

type FacingArcs = {
  front: { q: number; r: number }[]
  side: { q: number; r: number }[]
  rear: { q: number; r: number }[]
}

type BattleGridProps = {
  gridType: GridType
  radius: number
  playerPosition: GridPosition | null
  attackRange: number
  isPlayerTurn: boolean
  enemyPositions: GridPosition[]
  selectedTargetPosition: GridPosition | null
  moveTargetPosition: GridPosition | null
  facingArcs: FacingArcs
  reachableHexes: ReachableHexInfo[]
  onHexClick: (q: number, r: number) => void
}

type ArcType = 'front' | 'side' | 'rear' | 'none'

const getGridSystem = (gridType: GridType): GridSystem => {
  return gridType === 'square' ? squareGrid8 : hexGrid
}

const getCellColor = (
  q: number,
  r: number,
  playerPosition: GridPosition | null,
  attackRange: number,
  isPlayerTurn: boolean,
  enemyPositions: GridPosition[],
  selectedTargetPosition: GridPosition | null,
  moveTargetPosition: GridPosition | null,
  arcType: ArcType,
  isAlternate: boolean,
  isHovered: boolean,
  reachableHex: ReachableHexInfo | undefined,
  gridSystem: GridSystem
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
      const from: GridCoord = { q: playerPosition.x, r: playerPosition.z }
      const to: GridCoord = { q, r }
      const distance = gridSystem.distance(from, to)
      if (distance <= attackRange) {
        return isHovered ? '#cc4444' : '#aa2222'
      }
    }
    return isHovered ? '#882222' : '#661111'
  }
  
  if (playerPosition) {
    const from: GridCoord = { q: playerPosition.x, r: playerPosition.z }
    const to: GridCoord = { q, r }
    const distance = gridSystem.distance(from, to)
    
    if (distance === 0) {
       return isAlternate ? '#1a1a1a' : '#252525'
    }

    if (isPlayerTurn && reachableHex) {
      return isHovered ? '#66ff66' : '#2a5a2a'
    }
  }

  if (isHovered) {
    return '#444444'
  }

  if (arcType === 'front') {
    return isAlternate ? '#1a2a1a' : '#253525'
  } else if (arcType === 'side') {
    return isAlternate ? '#2a2a1a' : '#353525'
  } else if (arcType === 'rear') {
    return isAlternate ? '#2a1a1a' : '#352525'
  }
  
  return isAlternate ? '#1a1a1a' : '#252525'
}

const HexTile = ({ q, r, color, isInteractive, onClick, onHover, onUnhover, gridSystem }: { 
  q: number
  r: number
  color: string
  isInteractive: boolean
  onClick: () => void
  onHover: () => void
  onUnhover: () => void
  gridSystem: GridSystem
}) => {
  const worldPos = gridSystem.coordToWorld({ q, r })
  return (
    <mesh 
      position={[worldPos.x, -0.05, worldPos.z]} 
      onClick={(e) => { e.stopPropagation(); onClick() }}
      onPointerOver={(e) => { 
        e.stopPropagation()
        if (isInteractive) document.body.style.cursor = 'pointer'
        onHover() 
      }}
      onPointerOut={(e) => { 
        e.stopPropagation()
        document.body.style.cursor = 'default'
        onUnhover() 
      }}
    >
      <cylinderGeometry args={[gridSystem.size, gridSystem.size, 0.1, 6]} />
      <meshStandardMaterial color={color} />
    </mesh>
  )
}

const SquareTile = ({ q, r, color, isInteractive, onClick, onHover, onUnhover, gridSystem }: { 
  q: number
  r: number
  color: string
  isInteractive: boolean
  onClick: () => void
  onHover: () => void
  onUnhover: () => void
  gridSystem: GridSystem
}) => {
  const worldPos = gridSystem.coordToWorld({ q, r })
  const tileSize = gridSystem.size * 0.95
  return (
    <mesh 
      position={[worldPos.x, -0.05, worldPos.z]} 
      onClick={(e) => { e.stopPropagation(); onClick() }}
      onPointerOver={(e) => { 
        e.stopPropagation()
        if (isInteractive) document.body.style.cursor = 'pointer'
        onHover() 
      }}
      onPointerOut={(e) => { 
        e.stopPropagation()
        document.body.style.cursor = 'default'
        onUnhover() 
      }}
    >
      <boxGeometry args={[tileSize, 0.1, tileSize]} />
      <meshStandardMaterial color={color} />
    </mesh>
  )
}

export const BattleGrid = ({ 
  gridType, 
  radius, 
  playerPosition, 
  attackRange, 
  isPlayerTurn, 
  enemyPositions, 
  selectedTargetPosition, 
  moveTargetPosition, 
  facingArcs, 
  reachableHexes, 
  onHexClick 
}: BattleGridProps) => {
  const [hoveredCell, setHoveredCell] = useState<{q: number, r: number} | null>(null)
  const gridSystem = useMemo(() => getGridSystem(gridType), [gridType])

  const reachableMap = useMemo(() => {
    const map = new Map<string, ReachableHexInfo>()
    reachableHexes.forEach(hex => {
      map.set(`${hex.q},${hex.r}`, hex)
    })
    return map
  }, [reachableHexes])

  const tiles = useMemo(() => {
    const result: { q: number; r: number }[] = []
    if (gridType === 'hex') {
      for (let q = -radius; q <= radius; q += 1) {
        for (let r = -radius; r <= radius; r += 1) {
          if (Math.abs(q + r) > radius) continue
          result.push({ q, r })
        }
      }
    } else {
      for (let q = -radius; q <= radius; q += 1) {
        for (let r = -radius; r <= radius; r += 1) {
          result.push({ q, r })
        }
      }
    }
    return result
  }, [radius, gridType])

  const hoverInfo = useMemo(() => {
    if (!hoveredCell || !isPlayerTurn) return null
    
    const isEnemy = enemyPositions.some(pos => pos.x === hoveredCell.q && pos.z === hoveredCell.r)
    const worldPos = gridSystem.coordToWorld(hoveredCell)
    
    if (isEnemy) {
      return { 
        displayText: 'Click to target', 
        color: '#ffcc00', 
        position: [worldPos.x, 0.5, worldPos.z] as [number, number, number] 
      }
    }
    
    if (!playerPosition) return null
    const reachable = reachableMap.get(`${hoveredCell.q},${hoveredCell.r}`)
    const from: GridCoord = { q: playerPosition.x, r: playerPosition.z }
    const to: GridCoord = { q: hoveredCell.q, r: hoveredCell.r }
    const dist = gridSystem.distance(from, to)
    const color = reachable ? '#44ff44' : '#ff4444'
    const displayText = reachable ? `${reachable.cost}` : `${dist}`
    
    return { displayText, color, position: [worldPos.x, 0.5, worldPos.z] as [number, number, number] }
  }, [hoveredCell, playerPosition, isPlayerTurn, reachableMap, enemyPositions, gridSystem])

  const TileComponent = gridType === 'hex' ? HexTile : SquareTile

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
            {hoverInfo.displayText}
          </Text>
        </Billboard>
      )}
      {tiles.map(({ q, r }) => {
        const isAlternate = (q + r) % 2 === 0
        const isHovered = hoveredCell?.q === q && hoveredCell?.r === r
        const reachableHex = reachableMap.get(`${q},${r}`)
        
        let arcType: ArcType = 'none'
        if (facingArcs.front.some(h => h.q === q && h.r === r)) {
          arcType = 'front'
        } else if (facingArcs.side.some(h => h.q === q && h.r === r)) {
          arcType = 'side'
        } else if (facingArcs.rear.some(h => h.q === q && h.r === r)) {
          arcType = 'rear'
        }
        
        const color = getCellColor(
          q, r, playerPosition, attackRange, isPlayerTurn, enemyPositions, 
          selectedTargetPosition, moveTargetPosition, arcType, isAlternate, 
          isHovered, reachableHex, gridSystem
        )
        const isEnemy = enemyPositions.some(pos => pos.x === q && pos.z === r)
        const isReachable = reachableHex !== undefined
        const isInteractive = isPlayerTurn && (isEnemy || isReachable)
        return (
          <TileComponent
            key={`${q},${r}`}
            q={q}
            r={r}
            color={color}
            isInteractive={isInteractive}
            onClick={() => onHexClick(q, r)}
            onHover={() => setHoveredCell({ q, r })}
            onUnhover={() => setHoveredCell(null)}
            gridSystem={gridSystem}
          />
        )
      })}
    </group>
  )
}
