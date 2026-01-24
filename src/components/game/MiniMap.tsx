import { useMemo } from 'react'
import type { GridType } from '../../../shared/grid'
import type { MatchState } from '../../../shared/types'

type MiniMapProps = {
  matchState: MatchState | null
  playerId: string | null
}

const CELL_SIZE = 4
const MAP_SIZE = 150
const CENTER = MAP_SIZE / 2
const GRID_RADIUS = 10

const hexToPixel = (q: number, r: number) => {
  const x = CENTER + CELL_SIZE * Math.sqrt(3) * (q + r / 2)
  const y = CENTER + CELL_SIZE * 1.5 * r
  return { x, y }
}

const squareToPixel = (q: number, r: number) => {
  const x = CENTER + CELL_SIZE * q
  const y = CENTER + CELL_SIZE * r
  return { x, y }
}

const facingToAngle = (facing: number, gridType: GridType) => {
  if (gridType === 'square') {
    return facing * 45
  }
  return facing * 60
}

const getHexCells = (radius: number) => {
  const cells = []
  for (let q = -radius; q <= radius; q++) {
    const r1 = Math.max(-radius, -q - radius)
    const r2 = Math.min(radius, -q + radius)
    for (let r = r1; r <= r2; r++) {
      cells.push({ q, r })
    }
  }
  return cells
}

const getSquareCells = (radius: number) => {
  const cells = []
  for (let q = -radius; q <= radius; q++) {
    for (let r = -radius; r <= radius; r++) {
      cells.push({ q, r })
    }
  }
  return cells
}

function getHexPoints(x: number, y: number, size: number) {
  const points = []
  for (let i = 0; i < 6; i++) {
    const angleDeg = 60 * i + 30
    const angleRad = (Math.PI / 180) * angleDeg
    const px = x + size * Math.cos(angleRad)
    const py = y + size * Math.sin(angleRad)
    points.push(`${px},${py}`)
  }
  return points.join(' ')
}

function getSquarePoints(x: number, y: number, size: number) {
  const half = size * 0.45
  return `${x - half},${y - half} ${x + half},${y - half} ${x + half},${y + half} ${x - half},${y + half}`
}

export const MiniMap = ({ matchState, playerId }: MiniMapProps) => {
  const gridType: GridType = matchState?.rulesetId === 'pf2' ? 'square' : 'hex'
  const toPixel = gridType === 'hex' ? hexToPixel : squareToPixel
  
  const gridCells = useMemo(() => {
    return gridType === 'hex' ? getHexCells(GRID_RADIUS) : getSquareCells(GRID_RADIUS)
  }, [gridType])

  if (!matchState) return null

  return (
    <div className="mini-map-container">
      <svg width={MAP_SIZE} height={MAP_SIZE} viewBox={`0 0 ${MAP_SIZE} ${MAP_SIZE}`}>
        <circle cx={CENTER} cy={CENTER} r={MAP_SIZE / 2} fill="rgba(0, 0, 0, 0.8)" />
        
        <g className="mini-map-grid">
          {gridCells.map(({ q, r }) => {
            const { x, y } = toPixel(q, r)
            const points = gridType === 'hex' 
              ? getHexPoints(x, y, CELL_SIZE)
              : getSquarePoints(x, y, CELL_SIZE)
            return (
              <polygon
                key={`${q},${r}`}
                points={points}
                fill="none"
                stroke="rgba(255, 255, 255, 0.1)"
                strokeWidth="0.5"
              />
            )
          })}
        </g>

        {matchState.combatants.map((combatant) => {
          const { x: q, z: r } = combatant.position
          const pos = toPixel(q, r)
          const isPlayer = combatant.playerId === playerId
          const isActive = matchState.activeTurnPlayerId === combatant.playerId
          const angle = facingToAngle(combatant.facing, gridType)
          const color = isPlayer ? '#4f4' : '#f44'
          
          return (
            <g key={combatant.characterId} transform={`translate(${pos.x}, ${pos.y})`}>
              {isActive && (
                <circle
                  cx={0}
                  cy={0}
                  r={CELL_SIZE * 1.5}
                  fill="none"
                  stroke={color}
                  strokeWidth="1"
                  className="pulsing-indicator"
                >
                  <animate
                    attributeName="r"
                    values={`${CELL_SIZE};${CELL_SIZE * 2}`}
                    dur="1.5s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    values="1;0"
                    dur="1.5s"
                    repeatCount="indefinite"
                  />
                </circle>
              )}
              <g transform={`rotate(${angle})`}>
                <circle
                  cx={0}
                  cy={0}
                  r={CELL_SIZE * 0.8}
                  fill={color}
                  stroke="#000"
                  strokeWidth="1"
                />
                <polygon
                  points={`${CELL_SIZE * 1.2},0 ${CELL_SIZE * 0.4},-${CELL_SIZE * 0.4} ${CELL_SIZE * 0.4},${CELL_SIZE * 0.4}`}
                  fill={color}
                  stroke="#000"
                  strokeWidth="0.5"
                />
              </g>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
