import { OrbitControls, Environment, GizmoHelper, GizmoViewport, Html } from '@react-three/drei'
import { HexGrid } from './HexGrid'
import { Combatant } from './Combatant'
import { MoveMarker } from './MoveMarker'
import { hexToWorld } from '../../utils/hex'
import type { CombatantState, CharacterSheet, GridPosition, VisualEffect } from '../../../shared/types'

type ArenaSceneProps = {
  combatants: CombatantState[]
  characters: CharacterSheet[]
  playerId: string | null
  moveTarget: GridPosition | null
  selectedTargetId: string | null
  isPlayerTurn: boolean
  playerMoveRange: number
  visualEffects: (VisualEffect & { id: string })[]
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

export const ArenaScene = ({ combatants, characters, playerId, moveTarget, selectedTargetId, isPlayerTurn, playerMoveRange, visualEffects, onGridClick, onCombatantClick }: ArenaSceneProps) => {
  const playerCombatant = combatants.find(c => c.playerId === playerId)
  const playerPosition = playerCombatant?.position ?? null
  
  const enemyPositions = combatants
    .filter(c => c.playerId !== playerId)
    .map(c => c.position)
  
  const selectedTarget = combatants.find(c => c.playerId === selectedTargetId)
  const selectedTargetPosition = selectedTarget?.position ?? null

  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      
      <HexGrid 
        radius={10} 
        playerPosition={isPlayerTurn ? playerPosition : null}
        moveRange={isPlayerTurn ? playerMoveRange : 0}
        enemyPositions={enemyPositions}
        selectedTargetPosition={selectedTargetPosition}
        moveTargetPosition={moveTarget}
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

      <OrbitControls makeDefault />
      
      <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
        <GizmoViewport axisColors={['#9d4b4b', '#2f7f4f', '#3b5b9d']} labelColor="white" />
      </GizmoHelper>
      
      <Environment preset="city" />
    </>
  )
}
