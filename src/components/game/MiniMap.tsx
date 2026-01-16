import { useMemo } from 'react'
import type { MatchState } from '../../../shared/types'

type MiniMapProps = {
  matchState: MatchState | null
  playerId: string | null
}

const HEX_SIZE = 4
const MAP_SIZE = 150
const CENTER = MAP_SIZE / 2
const GRID_RADIUS = 10

export const MiniMap = ({ matchState, playerId }: MiniMapProps) => {
  if (!matchState) return null

  const hexToPixel = (q: number, r: number) => {
    const x = CENTER + HEX_SIZE * 1.5 * q
    const y = CENTER + HEX_SIZE * Math.sqrt(3) * (r + q / 2)
    return { x, y }
  }

  const gridHexes = useMemo(() => {
    const hexes = []
    for (let q = -GRID_RADIUS; q <= GRID_RADIUS; q++) {
      const r1 = Math.max(-GRID_RADIUS, -q - GRID_RADIUS)
      const r2 = Math.min(GRID_RADIUS, -q + GRID_RADIUS)
      for (let r = r1; r <= r2; r++) {
        hexes.push({ q, r })
      }
    }
    return hexes
  }, [])

  return (
    <div className="mini-map-container">
      <svg width={MAP_SIZE} height={MAP_SIZE} viewBox={`0 0 ${MAP_SIZE} ${MAP_SIZE}`}>
        <circle cx={CENTER} cy={CENTER} r={MAP_SIZE / 2} fill="rgba(0, 0, 0, 0.8)" />
        
        <g className="mini-map-grid">
          {gridHexes.map(({ q, r }) => {
            const { x, y } = hexToPixel(q, r)
            return (
              <polygon
                key={`${q},${r}`}
                points={getHexPoints(x, y, HEX_SIZE)}
                fill="none"
                stroke="rgba(255, 255, 255, 0.1)"
                strokeWidth="0.5"
              />
            )
          })}
        </g>

        {matchState.combatants.map((combatant) => {
          const { x: q, z: r } = combatant.position
          const pos = hexToPixel(q, r)
          const isPlayer = combatant.playerId === playerId
          const isActive = matchState.activeTurnPlayerId === combatant.playerId
          
          return (
            <g key={combatant.characterId}>
              {isActive && (
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={HEX_SIZE * 1.5}
                  fill="none"
                  stroke={isPlayer ? '#4f4' : '#f44'}
                  strokeWidth="1"
                  className="pulsing-indicator"
                >
                  <animate
                    attributeName="r"
                    values={`${HEX_SIZE};${HEX_SIZE * 2}`}
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
              <circle
                cx={pos.x}
                cy={pos.y}
                r={HEX_SIZE * 0.8}
                fill={isPlayer ? '#4f4' : '#f44'}
                stroke="#000"
                strokeWidth="1"
              />
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function getHexPoints(x: number, y: number, size: number) {
  const points = []
  for (let i = 0; i < 6; i++) {
    const angle_deg = 60 * i
    const angle_rad = (Math.PI / 180) * angle_deg
    const px = x + size * Math.cos(angle_rad)
    const py = y + size * Math.sin(angle_rad)
    points.push(`${px},${py}`)
  }
  return points.join(' ')
}
