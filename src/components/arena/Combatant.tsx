import { useState, useEffect, useRef } from 'react'
import { Html } from '@react-three/drei'
import { hexToWorld } from '../../utils/hex'
import type { CombatantState, CharacterSheet } from '../../../shared/types'

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
}

export const Combatant = ({ combatant, character, isPlayer, isSelected, onClick }: CombatantProps) => {
  const color = isPlayer ? '#646cff' : '#ff4444'
  const emissive = isSelected ? '#ffff00' : '#000000'
  const [x, z] = hexToWorld(combatant.position.x, combatant.position.z)
  const rotation = -combatant.facing * (Math.PI / 3)
  
  const maxHP = character?.derived.hitPoints ?? 10
  const hpPercent = Math.max(0, Math.min(100, (combatant.currentHP / maxHP) * 100))
  
  // Track HP for damage flash
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

  // Determine bar color
  let hpColor = '#4f4' // Green (>50%)
  if (combatant.currentHP <= 0) {
    hpColor = '#666' // Dead/Unconscious
  } else if (hpPercent <= 20) {
    hpColor = '#f44' // Red (low)
  } else if (hpPercent <= 50) {
    hpColor = '#ff4' // Yellow (<=50%)
  }

  return (
    <group position={[x, 0, z]}>
      <group rotation={[0, rotation, 0]}>
        <mesh position={[0, 1, 0]} onClick={onClick}>
          <capsuleGeometry args={[0.4, 0.8, 4, 8]} />
          <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={0.5} />
        </mesh>
        <mesh position={[0.4, 1.5, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <coneGeometry args={[0.2, 0.5, 8]} />
          <meshStandardMaterial color="#eeeeee" />
        </mesh>
      </group>
      
      {isSelected && (
        <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.5, 0.65, 6]} />
          <meshBasicMaterial color="#ff0" transparent opacity={0.8} />
        </mesh>
      )}

      {/* Floating Label & Health Bar */}
      <Html position={[0, 2.5, 0]} center style={{ pointerEvents: 'none', zIndex: 100 }}>
        <div className={`hp-bar-container ${isFlashing ? 'flash' : ''}`}>
          {combatant.statusEffects.length > 0 && (
            <div className="status-effects-row">
              {combatant.statusEffects.map((effect) => (
                <span key={effect} style={{ fontSize: '20px' }} title={effect}>
                  {STATUS_ICONS[effect] || effect}
                </span>
              ))}
            </div>
          )}

          <div className="hp-bar-name">
            {character?.name ?? 'Unknown'}
          </div>
          
          <div className="hp-bar-track">
            <div 
              className={`hp-bar-fill ${combatant.currentHP <= 0 ? 'dead' : ''}`}
              style={{ 
                width: `${hpPercent}%`,
                backgroundColor: hpColor
              }} 
            />
          </div>
          
          <div className="hp-bar-text">
            {Math.ceil(combatant.currentHP)} / {maxHP}
          </div>
        </div>
      </Html>
    </group>
  )
}

