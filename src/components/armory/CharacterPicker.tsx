import type { CharacterSheet } from '../../../shared/types'
import type { RulesetId } from '../../../shared/types'
import { isGurpsCharacter, isPF2Character } from '../../../shared/rulesets/characterSheet'
import './CharacterPicker.css'

type CharacterPickerProps = {
  characters: CharacterSheet[]
  rulesetId: RulesetId
  selectedCharacterId: string | null
  onSelect: (characterId: string) => void
  onQuickCreate: () => void
}

const getCharacterMeta = (character: CharacterSheet): string => {
  if (isGurpsCharacter(character)) {
    const topSkill = character.skills.length > 0
      ? character.skills.reduce((best, s) => s.level > best.level ? s : best).name
      : null
    return topSkill ? `GURPS · ${topSkill}` : 'GURPS'
  }
  if (isPF2Character(character)) {
    return character.class
      ? `PF2 · ${character.class} ${character.level}`
      : `PF2 · Lvl ${character.level}`
  }
  return ''
}

const filterByRuleset = (characters: CharacterSheet[], rulesetId: RulesetId): CharacterSheet[] => {
  return characters.filter((char) => {
    if (rulesetId === 'gurps') return isGurpsCharacter(char)
    if (rulesetId === 'pf2') return isPF2Character(char)
    return false
  })
}

export const CharacterPicker = ({
  characters,
  rulesetId,
  selectedCharacterId,
  onSelect,
  onQuickCreate,
}: CharacterPickerProps) => {
  const filtered = filterByRuleset(characters, rulesetId)

  return (
    <div className="character-picker">
      <div className="character-picker-header">
        <h3 className="character-picker-title">
          Select Character
          {filtered.length > 0 && (
            <span className="character-picker-count"> ({filtered.length})</span>
          )}
        </h3>
        <button
          className="character-picker-btn-create"
          onClick={onQuickCreate}
          type="button"
        >
          + Quick Create
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="character-picker-empty">
          <span className="character-picker-empty-icon">⚔️</span>
          <p className="character-picker-empty-text">
            No characters available for {rulesetId === 'gurps' ? 'GURPS' : 'Pathfinder 2e'}
          </p>
          <button
            className="character-picker-empty-cta"
            onClick={onQuickCreate}
            type="button"
          >
            Create Character
          </button>
        </div>
      ) : (
        <div className="character-picker-grid">
          {filtered.map((character) => {
            const isSelected = character.id === selectedCharacterId
            return (
              <button
                key={character.id}
                className={`character-picker-card ${isSelected ? 'selected' : ''}`}
                onClick={() => onSelect(character.id)}
                type="button"
                aria-pressed={isSelected}
              >
                <div className="character-picker-card-info">
                  <span className="character-picker-card-name">{character.name}</span>
                  <span className="character-picker-card-meta">{getCharacterMeta(character)}</span>
                </div>

                <div className="character-picker-card-stats">
                  <span className="character-picker-stat">
                    <span className="character-picker-stat-label">HP</span>
                    <span className="character-picker-stat-value">{character.derived.hitPoints}</span>
                  </span>
                  {isGurpsCharacter(character) && (
                    <span className="character-picker-stat">
                      <span className="character-picker-stat-label">ST</span>
                      <span className="character-picker-stat-value">{character.attributes.strength}</span>
                    </span>
                  )}
                  {isPF2Character(character) && (
                    <span className="character-picker-stat">
                      <span className="character-picker-stat-label">AC</span>
                      <span className="character-picker-stat-value">{character.derived.armorClass}</span>
                    </span>
                  )}
                </div>

                <span className={`character-picker-ruleset ruleset-${character.rulesetId}`}>
                  {character.rulesetId === 'gurps' ? 'GURPS' : 'PF2'}
                </span>

                {isSelected && (
                  <span className="character-picker-checkmark" aria-label="Selected">✓</span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
