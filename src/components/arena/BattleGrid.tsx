import { useMemo, useState } from 'react'
import { Text, Billboard } from '@react-three/drei'
import type { GridSystem, GridCoord, GridType } from '../../../shared/grid'
import { hexGrid, squareGrid8 } from '../../../shared/grid'
import type { GridPosition, ReachableHexInfo } from '../../../shared/types'
import type { MapDefinition } from '../../../shared/map/types'
import { isBlocked, isDifficultTerrain, hasCover } from '../../../shared/map/terrain'

type FacingArcs = {
  front: { q: number; r: number }[]
  side: { q: number; r: number }[]
  rear: { q: number; r: number }[]
}

type SpellTargetArea = {
  shape: string
  size: number
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
  mapDefinition?: MapDefinition
  spellTargetArea?: SpellTargetArea
}

type ArcType = 'front' | 'side' | 'rear' | 'none'

const getGridSystem = (gridType: GridType): GridSystem => {
  return gridType === 'square' ? squareGrid8 : hexGrid
}

type CellStyle = {
  color: string
  emissive: string
  emissiveIntensity: number
  edgeColor: string
  edgeOpacity: number
  elevation: number
}

const DEFAULT_EDGE_COLOR = '#333340'
const DEFAULT_EDGE_OPACITY = 0.4

const getCellStyle = (
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
  gridSystem: GridSystem,
  mapDef?: MapDefinition
): CellStyle => {
  const blocked = isBlocked(mapDef, q, r)
  const difficult = isDifficultTerrain(mapDef, q, r)
  const cover = hasCover(mapDef, q, r)

  const base: CellStyle = blocked
    ? { color: '#0a0a0c', emissive: '#000000', emissiveIntensity: 0, edgeColor: '#1a1a22', edgeOpacity: 0.2, elevation: -0.08 }
    : difficult
      ? { color: isAlternate ? '#2a2210' : '#2d2515', emissive: '#664400', emissiveIntensity: 0.05, edgeColor: '#554422', edgeOpacity: 0.5, elevation: -0.05 }
      : cover
        ? { color: isAlternate ? '#1a1a2a' : '#1e1e30', emissive: '#224466', emissiveIntensity: 0.08, edgeColor: '#336688', edgeOpacity: 0.6, elevation: -0.03 }
        : { color: isAlternate ? '#1a1a1a' : '#222228', emissive: '#000000', emissiveIntensity: 0, edgeColor: DEFAULT_EDGE_COLOR, edgeOpacity: DEFAULT_EDGE_OPACITY, elevation: -0.05 }

  if (blocked) return base

  if (moveTargetPosition && moveTargetPosition.x === q && moveTargetPosition.z === r) {
    return { ...base, color: '#1a3a1a', emissive: '#00ff00', emissiveIntensity: 0.6, edgeColor: '#00ff00', edgeOpacity: 0.9, elevation: 0 }
  }
  
  if (selectedTargetPosition && selectedTargetPosition.x === q && selectedTargetPosition.z === r) {
    return { ...base, color: '#3a3a1a', emissive: '#ffcc00', emissiveIntensity: 0.5, edgeColor: '#ffcc00', edgeOpacity: 0.9, elevation: 0 }
  }
  
  const isEnemy = enemyPositions.some(pos => pos.x === q && pos.z === r)
  if (isEnemy) {
    if (isPlayerTurn && playerPosition) {
      const from: GridCoord = { q: playerPosition.x, r: playerPosition.z }
      const to: GridCoord = { q, r }
      const distance = gridSystem.distance(from, to)
      if (distance <= attackRange) {
        const intensity = isHovered ? 0.5 : 0.3
        return { ...base, color: isHovered ? '#3a1515' : '#2a1010', emissive: '#ff2222', emissiveIntensity: intensity, edgeColor: '#ff4444', edgeOpacity: 0.8, elevation: isHovered ? 0.02 : 0 }
      }
    }
    return { ...base, color: isHovered ? '#2a1515' : '#1a0a0a', emissive: '#661111', emissiveIntensity: 0.15, edgeColor: '#882222', edgeOpacity: 0.6 }
  }
  
  if (playerPosition) {
    const from: GridCoord = { q: playerPosition.x, r: playerPosition.z }
    const to: GridCoord = { q, r }
    const distance = gridSystem.distance(from, to)
    
    if (distance === 0) {
      return { ...base, color: isAlternate ? '#1a1a2a' : '#222235', emissive: '#4466ff', emissiveIntensity: 0.15, edgeColor: '#4466ff', edgeOpacity: 0.6 }
    }

    if (isPlayerTurn && reachableHex) {
      const cost = reachableHex.cost
      if (cost <= 2) {
        const intensity = isHovered ? 0.4 : 0.2
        return { ...base, color: isHovered ? '#1a3a1a' : '#152a15', emissive: '#22cc44', emissiveIntensity: intensity, edgeColor: '#44ff44', edgeOpacity: 0.7, elevation: isHovered ? 0.02 : -0.03 }
      } else if (cost <= 4) {
        const intensity = isHovered ? 0.35 : 0.15
        return { ...base, color: isHovered ? '#3a3a1a' : '#2a2510', emissive: '#ccaa22', emissiveIntensity: intensity, edgeColor: '#ffdd44', edgeOpacity: 0.6, elevation: isHovered ? 0.02 : -0.03 }
      } else {
        const intensity = isHovered ? 0.3 : 0.1
        return { ...base, color: isHovered ? '#3a2a1a' : '#2a1510', emissive: '#cc6622', emissiveIntensity: intensity, edgeColor: '#ff8844', edgeOpacity: 0.5, elevation: isHovered ? 0.02 : -0.03 }
      }
    }
  }

  if (isHovered) {
    return { ...base, color: '#2a2a30', edgeColor: '#555566', edgeOpacity: 0.7, elevation: 0.01 }
  }

  if (arcType === 'front') {
    return { ...base, color: isAlternate ? '#1a2a1a' : '#202d20', edgeColor: '#2a4a2a', edgeOpacity: 0.5 }
  } else if (arcType === 'side') {
    return { ...base, color: isAlternate ? '#2a2a1a' : '#2d2d20', edgeColor: '#4a4a2a', edgeOpacity: 0.5 }
  } else if (arcType === 'rear') {
    return { ...base, color: isAlternate ? '#2a1a1a' : '#2d2020', edgeColor: '#4a2a2a', edgeOpacity: 0.5 }
  }
  
  return base
}

type TileProps = {
  q: number
  r: number
  style: CellStyle
  isInteractive: boolean
  onClick: () => void
  onHover: () => void
  onUnhover: () => void
  gridSystem: GridSystem
}

const HexTile = ({ q, r, style, isInteractive, onClick, onHover, onUnhover, gridSystem }: TileProps) => {
  const worldPos = gridSystem.coordToWorld({ q, r })
  return (
    <group position={[worldPos.x, style.elevation, worldPos.z]}>
      <mesh 
        receiveShadow
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
        <meshStandardMaterial
          color={style.color}
          emissive={style.emissive}
          emissiveIntensity={style.emissiveIntensity}
          roughness={0.85}
          metalness={0.1}
        />
      </mesh>
      <mesh position={[0, 0.051, 0]}>
        <cylinderGeometry args={[gridSystem.size * 0.98, gridSystem.size * 0.98, 0.005, 6]} />
        <meshBasicMaterial color={style.edgeColor} transparent opacity={style.edgeOpacity} wireframe />
      </mesh>
    </group>
  )
}

const SquareTile = ({ q, r, style, isInteractive, onClick, onHover, onUnhover, gridSystem }: TileProps) => {
  const worldPos = gridSystem.coordToWorld({ q, r })
  const tileSize = gridSystem.size * 0.95
  return (
    <group position={[worldPos.x, style.elevation, worldPos.z]}>
      <mesh 
        receiveShadow
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
        <meshStandardMaterial
          color={style.color}
          emissive={style.emissive}
          emissiveIntensity={style.emissiveIntensity}
          roughness={0.85}
          metalness={0.1}
        />
      </mesh>
      <mesh position={[0, 0.051, 0]}>
        <boxGeometry args={[tileSize * 0.98, 0.005, tileSize * 0.98]} />
        <meshBasicMaterial color={style.edgeColor} transparent opacity={style.edgeOpacity} wireframe />
      </mesh>
    </group>
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
  onHexClick,
  mapDefinition,
  spellTargetArea,
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

  const spellAreaHexes = useMemo(() => {
    if (!spellTargetArea || !hoveredCell) return new Set<string>()
    const set = new Set<string>()
    const { size } = spellTargetArea
    const center: GridCoord = { q: hoveredCell.q, r: hoveredCell.r }
    for (let q = hoveredCell.q - size; q <= hoveredCell.q + size; q++) {
      for (let r = hoveredCell.r - size; r <= hoveredCell.r + size; r++) {
        if (gridSystem.distance(center, { q, r }) <= size) {
          set.add(`${q},${r}`)
        }
      }
    }
    return set
  }, [spellTargetArea, hoveredCell, gridSystem])

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
    if (!hoveredCell) return null

    const worldPos = gridSystem.coordToWorld(hoveredCell)

    if (spellTargetArea) {
      return {
        displayText: 'Click to cast',
        color: '#ff6600',
        position: [worldPos.x, 0.5, worldPos.z] as [number, number, number]
      }
    }

    if (!isPlayerTurn) return null
    
    const isEnemy = enemyPositions.some(pos => pos.x === hoveredCell.q && pos.z === hoveredCell.r)
    
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
  }, [hoveredCell, playerPosition, isPlayerTurn, reachableMap, enemyPositions, gridSystem, spellTargetArea])

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
        
        let style = getCellStyle(
          q, r, playerPosition, attackRange, isPlayerTurn, enemyPositions, 
          selectedTargetPosition, moveTargetPosition, arcType, isAlternate, 
          isHovered, reachableHex, gridSystem, mapDefinition
        )
        
        const isInSpellArea = spellAreaHexes.has(`${q},${r}`)
        if (isInSpellArea) {
          style = { ...style, emissive: '#ff6600', emissiveIntensity: 0.6, edgeColor: '#ff4400', edgeOpacity: 0.9 }
        }

        const isEnemy = enemyPositions.some(pos => pos.x === q && pos.z === r)
        const isReachable = reachableHex !== undefined
        const isTargeting = !!spellTargetArea
        const isInteractive = isTargeting || (isPlayerTurn && (isEnemy || isReachable))
        return (
          <TileComponent
            key={`${q},${r}`}
            q={q}
            r={r}
            style={style}
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
