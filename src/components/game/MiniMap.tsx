import type { MatchState } from '../../../shared/types'

type MiniMapProps = {
  matchState: MatchState | null
  playerId: string | null
}

const HEX_SIZE = 4
const MAP_SIZE = 150
const CENTER = MAP_SIZE / 2
const GRID_RADIUS = 10

const hexToPixel = (q: number, r: number) => {
  const x = CENTER + HEX_SIZE * Math.sqrt(3) * (q + r / 2)
  const y = CENTER + HEX_SIZE * 1.5 * r
  return { x, y }
}

const facingToAngle = (facing: number) => {
  return facing * 60
}

const GRID_HEXES = (() => {
  const hexes = []
  for (let q = -GRID_RADIUS; q <= GRID_RADIUS; q++) {
    const r1 = Math.max(-GRID_RADIUS, -q - GRID_RADIUS)
    const r2 = Math.min(GRID_RADIUS, -q + GRID_RADIUS)
    for (let r = r1; r <= r2; r++) {
      hexes.push({ q, r })
    }
  }
  return hexes
})()

export const MiniMap = ({ matchState, playerId }: MiniMapProps) => {
  if (!matchState) return null

  return (
    <div className="mini-map-container">
      <svg width={MAP_SIZE} height={MAP_SIZE} viewBox={`0 0 ${MAP_SIZE} ${MAP_SIZE}`}>
        <circle cx={CENTER} cy={CENTER} r={MAP_SIZE / 2} fill="rgba(0, 0, 0, 0.8)" />
        
        <g className="mini-map-grid">
          {GRID_HEXES.map(({ q, r }) => {
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
          const angle = facingToAngle(combatant.facing)
          const color = isPlayer ? '#4f4' : '#f44'
          
          return (
            <g key={combatant.characterId} transform={`translate(${pos.x}, ${pos.y})`}>
              {isActive && (
                <circle
                  cx={0}
                  cy={0}
                  r={HEX_SIZE * 1.5}
                  fill="none"
                  stroke={color}
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
              <g transform={`rotate(${angle})`}>
                <circle
                  cx={0}
                  cy={0}
                  r={HEX_SIZE * 0.8}
                  fill={color}
                  stroke="#000"
                  strokeWidth="1"
                />
                <polygon
                  points={`${HEX_SIZE * 1.2},0 ${HEX_SIZE * 0.4},-${HEX_SIZE * 0.4} ${HEX_SIZE * 0.4},${HEX_SIZE * 0.4}`}
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
