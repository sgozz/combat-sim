import { hexToWorld } from '../../utils/hex'
import type { CombatantState, CharacterSheet } from '../../../shared/types'

type CombatantProps = {
  combatant: CombatantState
  character: CharacterSheet | undefined
  isPlayer: boolean
  isSelected: boolean
  onClick: () => void
}

export const Combatant = ({ combatant, character, isPlayer, isSelected, onClick }: CombatantProps) => {
  const color = isPlayer ? '#646cff' : '#ff4444'
  const emissive = isSelected ? '#ffff00' : '#000000'
  const [x, z] = hexToWorld(combatant.position.x, combatant.position.z)
  
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 1, 0]} onClick={onClick}>
        <capsuleGeometry args={[0.4, 0.8, 4, 8]} />
        <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={0.5} />
      </mesh>
      {isSelected && (
        <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.5, 0.65, 6]} />
          <meshBasicMaterial color="#ff0" transparent opacity={0.8} />
        </mesh>
      )}
      <mesh position={[0, 1.9, 0]}>
        <planeGeometry args={[1, 0.15]} />
        <meshBasicMaterial color="#333" />
      </mesh>
      {character && (
        <mesh position={[-(1 - combatant.currentHP / character.derived.hitPoints) / 2, 1.9, 0.01]}>
          <planeGeometry args={[Math.max(0.01, combatant.currentHP / character.derived.hitPoints), 0.12]} />
          <meshBasicMaterial color={combatant.currentHP > character.derived.hitPoints / 3 ? '#4f4' : '#f44'} />
        </mesh>
      )}
    </group>
  )
}
