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
}

export const Combatant = ({ combatant, character, isPlayer, isSelected, onClick }: CombatantProps) => {
  const color = isPlayer ? '#646cff' : '#ff4444'
  const emissive = isSelected ? '#ffff00' : '#000000'
  const [x, z] = hexToWorld(combatant.position.x, combatant.position.z)
  const rotation = -combatant.facing * (Math.PI / 3)
  
  const maxHP = character?.derived.hitPoints ?? 10
  const hpPercent = Math.max(0, Math.min(100, (combatant.currentHP / maxHP) * 100))
  const hpColor = hpPercent > 50 ? '#44ff44' : hpPercent > 20 ? '#ffff44' : '#ff4444'

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
      <Html position={[0, 2.5, 0]} center style={{ pointerEvents: 'none' }}>
        <div style={{ 
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '2px'
        }}>
          {combatant.statusEffects.length > 0 && (
            <div style={{ 
              display: 'flex', 
              gap: '4px', 
              marginBottom: '2px',
              textShadow: '0 0 4px black'
            }}>
              {combatant.statusEffects.map((effect) => (
                <span key={effect} style={{ fontSize: '20px' }} title={effect}>
                  {STATUS_ICONS[effect] || effect}
                </span>
              ))}
            </div>
          )}

          <div style={{ 
            background: 'rgba(0,0,0,0.6)', 
            padding: '4px 8px', 
            borderRadius: '4px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '2px',
            minWidth: '80px'
          }}>
            <div style={{ 
              color: 'white', 
              fontSize: '12px', 
              fontWeight: 'bold',
              whiteSpace: 'nowrap'
            }}>
              {character?.name ?? 'Unknown'}
            </div>
            <div style={{ 
              width: '100%', 
              height: '4px', 
              background: '#333', 
              borderRadius: '2px',
              overflow: 'hidden'
            }}>
              <div style={{ 
                width: `${hpPercent}%`, 
                height: '100%', 
                background: hpColor,
                transition: 'width 0.3s ease-out'
              }} />
            </div>
          </div>
        </div>
      </Html>
    </group>
  )
}
