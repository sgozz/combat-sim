import { OrbitControls, Environment, GizmoHelper, GizmoViewport, Html } from '@react-three/drei'
import { BattleGrid } from './BattleGrid'
import { Combatant } from './Combatant'
import { MoveMarker } from './MoveMarker'
import { CombatEffects } from './CombatEffects'
import { EnvironmentProps } from './EnvironmentProps'
import { CameraControls, type CameraMode } from './CameraControls'
import { getHexInDirection } from '../../utils/hex'
import { hexGrid, squareGrid8 } from '../../../shared/grid'
import type { CharacterSheet, GridPosition, VisualEffect, ReachableHexInfo, RulesetId } from '../../../shared/types'
import type { CombatantState } from '../../../shared/rulesets'
import type { MapDefinition } from '../../../shared/map/types'
import { isPF2Character, isGurpsCharacter } from '../../../shared/rulesets/characterSheet'
import { getGridType, getServerAdapter } from '../../../shared/rulesets'
import { useMemo, useState, useEffect } from 'react'

type ArenaSceneProps = {
  combatants: CombatantState[]
  characters: CharacterSheet[]
  playerId: string | null
  activeTurnPlayerId: string | null
  moveTarget: GridPosition | null
  selectedTargetId: string | null
  isPlayerTurn: boolean
  reachableHexes: ReachableHexInfo[]
  visualEffects: (VisualEffect & { id: string })[]
  cameraMode: CameraMode
  rulesetId: RulesetId
  mapDefinition?: MapDefinition
  onGridClick: (position: GridPosition) => void
  onCombatantClick: (playerId: string) => void
}

const FloatingText = ({ effect, rulesetId }: { effect: VisualEffect; rulesetId: RulesetId }) => {
  const gridSystem = getGridType(rulesetId) === 'square' ? squareGrid8 : hexGrid
  const worldPos = gridSystem.coordToWorld({ q: effect.position.x, r: effect.position.z })
  
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
    <Html position={[worldPos.x, 3, worldPos.z]} center zIndexRange={[0, 50]} style={{ pointerEvents: 'none' }}>
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

export const ArenaScene = ({ combatants, characters, playerId, activeTurnPlayerId, moveTarget, selectedTargetId, isPlayerTurn, reachableHexes, visualEffects, cameraMode, rulesetId, mapDefinition, onGridClick, onCombatantClick }: ArenaSceneProps) => {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)
  
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const playerCombatant = combatants.find(c => c.playerId === playerId)
  const playerPosition = playerCombatant?.position ?? null
  
  const activeCombatant = combatants.find(c => c.playerId === activeTurnPlayerId)
  const activeCombatantPosition = activeCombatant?.position ?? null
  
  const enemyPositions = combatants
    .filter(c => c.playerId !== playerId)
    .map(c => c.position)

  const focusPositions = combatants.map(c => c.position)
  
  const selectedTarget = combatants.find(c => c.playerId === selectedTargetId)
  const selectedTargetPosition = selectedTarget?.position ?? null

  const attackRange = useMemo(() => {
    if (!playerCombatant) return 1
    const character = characters.find(c => c.id === playerCombatant.characterId)
    if (!character) return 1

    let maxRange = 1
    
    if (isPF2Character(character)) {
      (character.weapons ?? []).forEach(weapon => {
        if (weapon.traits.includes('reach')) {
          maxRange = Math.max(maxRange, 2)
        }
        if (weapon.traits.includes('thrown')) {
          maxRange = Math.max(maxRange, 4)
        }
      })
    }
    else if (isGurpsCharacter(character)) {
      (character.equipment ?? []).forEach(item => {
        if (item.type === 'melee' && item.reach) {
          const reachNumbers = item.reach.split(',').map((r: string) => r === 'C' ? 0 : parseInt(r, 10)).filter((n: number) => !isNaN(n))
          const itemMaxReach = Math.max(...reachNumbers, 1)
          maxRange = Math.max(maxRange, itemMaxReach)
        }
        if (item.type === 'ranged' && item.range) {
          const parts = item.range.split('/')
          const itemMax = parseInt(parts[parts.length - 1], 10)
          if (!isNaN(itemMax)) {
            maxRange = Math.max(maxRange, itemMax)
          }
        }
      })
    }
    return maxRange
  }, [playerCombatant, characters])

   const facingArcs = useMemo(() => {
     const emptyArcs = { front: [], side: [], rear: [] }
     if (!playerCombatant?.position) return emptyArcs
     if (!getServerAdapter(rulesetId).hasFacingArcs) return emptyArcs
    
    const { x: q, z: r } = playerCombatant.position
    const f = playerCombatant.facing ?? 0
    return {
      front: [
        getHexInDirection(q, r, -f),
        getHexInDirection(q, r, -f - 1),
        getHexInDirection(q, r, -f + 1),
      ],
      side: [
        getHexInDirection(q, r, -f + 2),
        getHexInDirection(q, r, -f - 2),
      ],
      rear: [
        getHexInDirection(q, r, -f + 3),
      ],
    }
  }, [playerCombatant, rulesetId])

  return (
    <>
      <ambientLight intensity={0.3} color="#8899bb" />
      <directionalLight
        position={[8, 15, 5]}
        intensity={1.2}
        color="#ffeedd"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={50}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
        shadow-bias={-0.001}
      />
      <pointLight position={[-5, 8, -5]} intensity={0.3} color="#4466ff" />

      <fog attach="fog" args={['#0a0a12', 15, 45]} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.15, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color="#111115" roughness={0.95} metalness={0.05} />
      </mesh>
      
      <BattleGrid 
        gridType={getGridType(rulesetId)}
        radius={10} 
        playerPosition={isPlayerTurn ? playerPosition : null}
        attackRange={attackRange}
        isPlayerTurn={isPlayerTurn}
        enemyPositions={enemyPositions}
        selectedTargetPosition={selectedTargetPosition}
        moveTargetPosition={moveTarget}
        facingArcs={facingArcs}
        reachableHexes={reachableHexes}
        onHexClick={(q: number, r: number) => {
          const enemyAtHex = combatants.find(c => c.playerId !== playerId && c.position.x === q && c.position.z === r)
          if (enemyAtHex) {
            onCombatantClick(enemyAtHex.playerId)
          } else {
            onGridClick({ x: q, y: 0, z: r })
          }
        }}
      />

      <EnvironmentProps mapDefinition={mapDefinition} gridType={getGridType(rulesetId)} />
      
       {combatants.map((combatant) => (
         <Combatant
           key={combatant.playerId}
           combatant={combatant}
           character={characters.find(c => c.id === combatant.characterId)}
           isPlayer={combatant.playerId === playerId}
           isSelected={combatant.playerId === selectedTargetId}
           visualEffects={visualEffects}
           gridType={getGridType(rulesetId)}
          onClick={() => onCombatantClick(combatant.playerId)}
        />
      ))}

      {visualEffects.map((effect) => (
        <FloatingText key={effect.id} effect={effect} rulesetId={rulesetId} />
      ))}

      <CombatEffects visualEffects={visualEffects} gridType={getGridType(rulesetId)} />

       {moveTarget && <MoveMarker position={moveTarget} gridType={getGridType(rulesetId)} />}

      <CameraControls targetPosition={activeCombatantPosition} focusPositions={focusPositions} mode={cameraMode} />
      <OrbitControls makeDefault />
      
      {!isMobile && (
        <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
          <GizmoViewport axisColors={['#9d4b4b', '#2f7f4f', '#3b5b9d']} labelColor="white" />
        </GizmoHelper>
      )}
      
      <Environment preset="city" />
    </>
  )
}
