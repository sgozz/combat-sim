import { useState, useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { hexToWorld } from '../../utils/hex'
import type { CombatantState, CharacterSheet } from '../../../shared/types'
import * as THREE from 'three'

type CombatantProps = {
  combatant: CombatantState
  character: CharacterSheet | undefined
  isPlayer: boolean
  isSelected: boolean
  onClick: () => void
}

const STATUS_ICONS: Record<string, string> = {
  shock: '⚡',
  defending: '🛡️',
  stunned: '😵',
  aiming: '🎯',
  unconscious: '💤',
  dead: '💀',
  grappling: '🤼',
  grappled: '🔒',
  close_combat: '⚔️',
}

function StickFigure({ color, emissive }: { color: string; emissive: string }) {
  return (
    <group>
      {/* Head - top at 1.80m */}
      <mesh position={[0, 1.62, 0]}>
        <sphereGeometry args={[0.18, 12, 12]} />
        <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={0.5} />
      </mesh>
      
      {/* Torso */}
      <mesh position={[0, 1.1, 0]}>
        <capsuleGeometry args={[0.12, 0.55, 4, 8]} />
        <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={0.5} />
      </mesh>
      
      {/* Left Arm */}
      <mesh position={[0, 1.15, -0.22]} rotation={[0.2, 0, 0]}>
        <capsuleGeometry args={[0.05, 0.4, 4, 8]} />
        <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={0.5} />
      </mesh>
      
      {/* Right Arm */}
      <mesh position={[0, 1.15, 0.22]} rotation={[-0.2, 0, 0]}>
        <capsuleGeometry args={[0.05, 0.4, 4, 8]} />
        <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={0.5} />
      </mesh>
      
      {/* Left Leg */}
      <mesh position={[0, 0.42, -0.1]} rotation={[0.1, 0, 0]}>
        <capsuleGeometry args={[0.06, 0.5, 4, 8]} />
        <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={0.5} />
      </mesh>
      
      {/* Right Leg */}
      <mesh position={[0, 0.42, 0.1]} rotation={[-0.1, 0, 0]}>
        <capsuleGeometry args={[0.06, 0.5, 4, 8]} />
        <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={0.5} />
      </mesh>
      
      {/* Direction indicator */}
      <mesh position={[0.22, 1.62, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.08, 0.15, 6]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
    </group>
  )
}

export const Combatant = ({ combatant, character, isPlayer, isSelected, onClick }: CombatantProps) => {
  const color = isPlayer ? '#646cff' : '#ff4444'
  const emissive = isSelected ? '#ffff00' : '#000000'
  const [targetX, targetZ] = hexToWorld(combatant.position.x, combatant.position.z)
  const targetRotation = -combatant.facing * (Math.PI / 3)

  const groupRef = useRef<THREE.Group>(null)
  const currentPos = useRef(new THREE.Vector3(targetX, 0, targetZ))
  const currentRot = useRef(targetRotation)
  
  useFrame((_, delta) => {
    if (!groupRef.current) return
    
    const lerpFactor = 1 - Math.pow(0.001, delta)
    
    currentPos.current.x = THREE.MathUtils.lerp(currentPos.current.x, targetX, lerpFactor)
    currentPos.current.z = THREE.MathUtils.lerp(currentPos.current.z, targetZ, lerpFactor)
    
    let rotDiff = targetRotation - currentRot.current
    while (rotDiff > Math.PI) rotDiff -= Math.PI * 2
    while (rotDiff < -Math.PI) rotDiff += Math.PI * 2
    currentRot.current += rotDiff * lerpFactor
    
    groupRef.current.position.x = currentPos.current.x
    groupRef.current.position.z = currentPos.current.z
    groupRef.current.rotation.y = currentRot.current
  })
  
  const maxHP = character?.derived.hitPoints ?? 10
  const hpPercent = Math.max(0, Math.min(100, (combatant.currentHP / maxHP) * 100))
  
  const [isFlashing, setIsFlashing] = useState(false)
  const prevHpRef = useRef(combatant.currentHP)

  useEffect(() => {
    if (combatant.currentHP < prevHpRef.current) {
      setIsFlashing(true)
      const timer = setTimeout(() => setIsFlashing(false), 400)
      return () => clearTimeout(timer)
    }
    prevHpRef.current = combatant.currentHP
  }, [combatant.currentHP])

  let hpColor = '#4f4'
  if (combatant.currentHP <= 0) {
    hpColor = '#666'
  } else if (hpPercent <= 20) {
    hpColor = '#f44'
  } else if (hpPercent <= 50) {
    hpColor = '#ff4'
  }
  
  const isGrappling = combatant.grapple?.grappling != null
  const isGrappled = combatant.grapple?.grappledBy != null
  const inCloseCombat = combatant.inCloseCombatWith != null

  return (
    <group ref={groupRef} position={[targetX, 0, targetZ]} onClick={(e) => { e.stopPropagation(); onClick() }}>
      <StickFigure color={color} emissive={emissive} />
      
      {isSelected && (
        <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.5, 0.65, 6]} />
          <meshBasicMaterial color="#ff0" transparent opacity={0.8} />
        </mesh>
      )}
      
      {inCloseCombat && !isSelected && (
        <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.45, 0.55, 6]} />
          <meshBasicMaterial color={isGrappling || isGrappled ? '#f80' : '#f0f'} transparent opacity={0.6} />
        </mesh>
      )}

      <Html position={[0, 2.5, 0]} center style={{ zIndex: 10, pointerEvents: 'none' }}>
        <div className={`hp-bar-compact ${isFlashing ? 'flash' : ''}`}>
          <div className="hp-bar-name-compact">{character?.name ?? '?'}</div>
          <div className="hp-bar-track-compact">
            <div 
              className="hp-bar-fill-compact"
              style={{ width: `${hpPercent}%`, backgroundColor: hpColor }} 
            />
          </div>
          {(combatant.statusEffects.length > 0 || inCloseCombat) && (
            <div className="status-icons-compact">
              {isGrappling && <span title="Grappling">{STATUS_ICONS.grappling}</span>}
              {isGrappled && <span title="Grappled">{STATUS_ICONS.grappled}</span>}
              {inCloseCombat && !isGrappling && !isGrappled && <span title="Close Combat">{STATUS_ICONS.close_combat}</span>}
              {combatant.statusEffects.slice(0, 2).map((effect) => (
                <span key={effect} title={effect}>{STATUS_ICONS[effect] || '•'}</span>
              ))}
            </div>
          )}
        </div>
        <div className="hp-bar-details">
          <div className="hp-bar-details-content">
            <div className="hp-detail-name">{character?.name ?? 'Unknown'}</div>
            <div className="hp-detail-hp">{Math.ceil(combatant.currentHP)} / {maxHP} HP</div>
            {(combatant.statusEffects.length > 0 || inCloseCombat) && (
              <div className="hp-detail-status">
                {isGrappling && <span className="status-tag">{STATUS_ICONS.grappling} Grappling</span>}
                {isGrappled && <span className="status-tag">{STATUS_ICONS.grappled} Grappled</span>}
                {inCloseCombat && !isGrappling && !isGrappled && <span className="status-tag">{STATUS_ICONS.close_combat} Close Combat</span>}
                {combatant.statusEffects.map((effect) => (
                  <span key={effect} className="status-tag">
                    {STATUS_ICONS[effect]} {effect}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </Html>
    </group>
  )
}
