import { OrbitControls, Environment, GizmoHelper, GizmoViewport, Html } from '@react-three/drei'
import { HexGrid } from './HexGrid'
import { Combatant } from './Combatant'
import { MoveMarker } from './MoveMarker'
import { CameraControls, type CameraMode } from './CameraControls'
import { hexToWorld, getHexInDirection } from '../../utils/hex'
import type { CombatantState, CharacterSheet, GridPosition, VisualEffect } from '../../../shared/types'
import { useMemo } from 'react'

type ArenaSceneProps = {
  combatants: CombatantState[]
  characters: CharacterSheet[]
  playerId: string | null
  activeTurnPlayerId: string | null
  moveTarget: GridPosition | null
  selectedTargetId: string | null
  isPlayerTurn: boolean
  playerMoveRange: number
  visualEffects: (VisualEffect & { id: string })[]
  cameraMode: CameraMode
  onGridClick: (position: GridPosition) => void
  onCombatantClick: (playerId: string) => void
}

const FloatingText = ({ effect }: { effect: VisualEffect }) => {
  const [x, z] = hexToWorld(effect.position.x, effect.position.z)
  
  let content = ''
  let color = 'white'
  
  if (effect.type === 'damage') {
    content = `-${effect.value}`
    color = '#ff4444'
  } else if (effect.type === 'miss') {
    content = 'Miss'
    color = '#aaaaaa'
  } else if (effect.type === 'defend') {
    content = 'Blocked'
    color = '#4444ff'
  }

  return (
    <Html position={[x, 3, z]} center style={{ pointerEvents: 'none' }}>
      <div style={{
        color,
        fontSize: '24px',
        fontWeight: 'bold',
        textShadow: '0 0 4px black',
        animation: 'floatUp 1s ease-out forwards'
      }}>
        {content}
      </div>
    </Html>
  )
}

export const ArenaScene = ({ combatants, characters, playerId, activeTurnPlayerId, moveTarget, selectedTargetId, isPlayerTurn, playerMoveRange, visualEffects, cameraMode, onGridClick, onCombatantClick }: ArenaSceneProps) => {
  const playerCombatant = combatants.find(c => c.playerId === playerId)
  const playerPosition = playerCombatant?.position ?? null
  
  const activeCombatant = combatants.find(c => c.playerId === activeTurnPlayerId)
  const activeCombatantPosition = activeCombatant?.position ?? null
  
  const enemyPositions = combatants
    .filter(c => c.playerId !== playerId)
    .map(c => c.position)
  
  const selectedTarget = combatants.find(c => c.playerId === selectedTargetId)
  const selectedTargetPosition = selectedTarget?.position ?? null

  const attackRange = useMemo(() => {
    if (!playerCombatant) return 1
    const character = characters.find(c => c.id === playerCombatant.characterId)
    if (!character) return 1

    let maxRange = 1
    // Check for melee reach and ranged range
    character.equipment.forEach(item => {
      if (item.type === 'melee' && item.reach) {
        maxRange = Math.max(maxRange, item.reach)
      }
      if (item.type === 'ranged' && item.range) {
        // Parse range like "100/200" or "50"
        const parts = item.range.split('/')
        const itemMax = parseInt(parts[parts.length - 1], 10)
        if (!isNaN(itemMax)) {
          maxRange = Math.max(maxRange, itemMax)
        }
      }
    })
    return maxRange
  }, [playerCombatant, characters])

  const frontArcHexes = useMemo(() => {
    if (!playerCombatant?.position) return []
    const { x: q, z: r } = playerCombatant.position
    const f = playerCombatant.facing ?? 0
    return [
      getHexInDirection(q, r, f),
      getHexInDirection(q, r, f - 1),
      getHexInDirection(q, r, f + 1),
    ]
  }, [playerCombatant])

  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      
      <HexGrid 
        radius={10} 
        playerPosition={isPlayerTurn ? playerPosition : null}
        moveRange={isPlayerTurn ? playerMoveRange : 0}
        attackRange={attackRange}
        isPlayerTurn={isPlayerTurn}
        enemyPositions={enemyPositions}
        selectedTargetPosition={selectedTargetPosition}
        moveTargetPosition={moveTarget}
        frontArcHexes={frontArcHexes}
        onHexClick={(q, r) => onGridClick({ x: q, y: 0, z: r })}
      />
      
      {combatants.map((combatant) => (
        <Combatant
          key={combatant.playerId}
          combatant={combatant}
          character={characters.find(c => c.id === combatant.characterId)}
          isPlayer={combatant.playerId === playerId}
          isSelected={combatant.playerId === selectedTargetId}
          onClick={() => onCombatantClick(combatant.playerId)}
        />
      ))}

      {visualEffects.map((effect) => (
        <FloatingText key={effect.id} effect={effect} />
      ))}

      {moveTarget && <MoveMarker position={moveTarget} />}

      <CameraControls targetPosition={activeCombatantPosition} mode={cameraMode} />
      <OrbitControls makeDefault />
      
      <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
        <GizmoViewport axisColors={['#9d4b4b', '#2f7f4f', '#3b5b9d']} labelColor="white" />
      </GizmoHelper>
      
      <Environment preset="city" />
    </>
  )
}
