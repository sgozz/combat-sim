import type { CharacterSheet } from '../../../shared/types'
import { isGurpsCharacter } from '../../../shared/types'
import type { CombatantState } from '../../../shared/rulesets'
import { isGurpsCombatant } from '../../../shared/rulesets'

type FloatingStatusProps = {
  combatant: CombatantState | null
  character: CharacterSheet | null
}

export const FloatingStatus = ({ combatant, character }: FloatingStatusProps) => {
  if (!combatant || !character) return null

  const hpPercent = Math.max(0, (combatant.currentHP / character.derived.hitPoints) * 100)
  const fpPercent = isGurpsCharacter(character) && isGurpsCombatant(combatant)
    ? Math.max(0, (combatant.currentFP / character.derived.fatiguePoints) * 100)
    : 0

  let hpColor = '#4f4'
  if (hpPercent <= 20) hpColor = '#f44'
  else if (hpPercent <= 50) hpColor = '#ff4'

  return (
    <div className="floating-status">
      <div className="status-name">{character.name}</div>
      
      <div className="status-bar-row">
        <span className="status-label">HP</span>
        <div className="status-bar-track">
          <div 
            className="status-bar-fill" 
            style={{ width: `${hpPercent}%`, backgroundColor: hpColor }}
          />
        </div>
        <span className="status-value">{combatant.currentHP}/{character.derived.hitPoints}</span>
      </div>
      
      {isGurpsCharacter(character) && isGurpsCombatant(combatant) && (
        <div className="status-bar-row">
          <span className="status-label">FP</span>
          <div className="status-bar-track">
            <div 
              className="status-bar-fill fp" 
              style={{ width: `${fpPercent}%` }}
            />
          </div>
          <span className="status-value">{combatant.currentFP}/{character.derived.fatiguePoints}</span>
        </div>
      )}

      {combatant.statusEffects.length > 0 && (
        <div className="status-effects">
          {combatant.statusEffects.map(effect => (
            <span key={effect} className="status-effect-tag">{effect}</span>
          ))}
        </div>
      )}
    </div>
  )
}
