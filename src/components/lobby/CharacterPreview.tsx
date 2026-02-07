import { useState, useCallback } from 'react'
import type { CharacterSheet, RulesetId } from '../../../shared/types'
import { isGurpsCharacter, isPF2Character } from '../../../shared/rulesets/characterSheet'
import { CharacterPicker } from '../armory/CharacterPicker'
import './CharacterPreview.css'

const useIsMobile = () => {
  const [isMobile] = useState(() => window.matchMedia('(max-width: 768px)').matches)
  return isMobile
}

type CharacterPreviewProps = {
  characters: CharacterSheet[]
  selectedCharacterId: string | null
  rulesetId: RulesetId
  currentUserId: string
  onSelectCharacter: (characterId: string) => void
  onNavigateToArmory: () => void
}

const GurpsStats = ({ character }: { character: CharacterSheet }) => {
  if (!isGurpsCharacter(character)) return null

  const weapons = character.equipment.filter(e => e.type === 'melee' || e.type === 'ranged')
  const armor = character.equipment.filter(e => e.type === 'armor')

  return (
    <>
      <section className="character-preview-section">
        <h4 className="character-preview-section-title">Attributes</h4>
        <div className="character-preview-attr-grid">
          <div className="character-preview-attr">
            <span className="character-preview-attr-label">ST</span>
            <span className="character-preview-attr-value">{character.attributes.strength}</span>
          </div>
          <div className="character-preview-attr">
            <span className="character-preview-attr-label">DX</span>
            <span className="character-preview-attr-value">{character.attributes.dexterity}</span>
          </div>
          <div className="character-preview-attr">
            <span className="character-preview-attr-label">IQ</span>
            <span className="character-preview-attr-value">{character.attributes.intelligence}</span>
          </div>
          <div className="character-preview-attr">
            <span className="character-preview-attr-label">HT</span>
            <span className="character-preview-attr-value">{character.attributes.health}</span>
          </div>
        </div>
      </section>

      <section className="character-preview-section">
        <h4 className="character-preview-section-title">Derived</h4>
        <div className="character-preview-attr-grid">
          <div className="character-preview-attr">
            <span className="character-preview-attr-label">HP</span>
            <span className="character-preview-attr-value">{character.derived.hitPoints}</span>
          </div>
          <div className="character-preview-attr">
            <span className="character-preview-attr-label">FP</span>
            <span className="character-preview-attr-value">{character.derived.fatiguePoints}</span>
          </div>
          <div className="character-preview-attr">
            <span className="character-preview-attr-label">Move</span>
            <span className="character-preview-attr-value">{character.derived.basicMove}</span>
          </div>
          <div className="character-preview-attr">
            <span className="character-preview-attr-label">Dodge</span>
            <span className="character-preview-attr-value">{character.derived.dodge}</span>
          </div>
        </div>
      </section>

      {character.skills.length > 0 && (
        <section className="character-preview-section">
          <h4 className="character-preview-section-title">Top Skills</h4>
          <ul className="character-preview-skill-list">
            {character.skills
              .slice()
              .sort((a, b) => b.level - a.level)
              .slice(0, 5)
              .map(skill => (
                <li key={skill.id} className="character-preview-skill">
                  <span className="character-preview-skill-name">{skill.name}</span>
                  <span className="character-preview-skill-level">{skill.level}</span>
                </li>
              ))}
          </ul>
        </section>
      )}

      {weapons.length > 0 && (
        <section className="character-preview-section">
          <h4 className="character-preview-section-title">Weapons</h4>
          <ul className="character-preview-equip-list">
            {weapons.map(w => (
              <li key={w.id} className="character-preview-equip">
                <span className="character-preview-equip-name">{w.name}</span>
                {w.damage && <span className="character-preview-equip-detail">{w.damage}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {armor.length > 0 && (
        <section className="character-preview-section">
          <h4 className="character-preview-section-title">Armor</h4>
          <ul className="character-preview-equip-list">
            {armor.map(a => (
              <li key={a.id} className="character-preview-equip">
                <span className="character-preview-equip-name">{a.name}</span>
                {a.dr !== undefined && <span className="character-preview-equip-detail">DR {a.dr}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="character-preview-points">
        <span className="character-preview-points-label">Point Total</span>
        <span className="character-preview-points-value">{character.pointsTotal} pts</span>
      </div>
    </>
  )
}

const PF2Stats = ({ character }: { character: CharacterSheet }) => {
  if (!isPF2Character(character)) return null

  return (
    <>
      <section className="character-preview-section">
        <h4 className="character-preview-section-title">
          {character.class} · Level {character.level}
        </h4>
        <p className="character-preview-ancestry">
          {character.ancestry} {character.heritage && `(${character.heritage})`}
        </p>
      </section>

      <section className="character-preview-section">
        <h4 className="character-preview-section-title">Abilities</h4>
        <div className="character-preview-attr-grid character-preview-attr-grid--6">
          <div className="character-preview-attr">
            <span className="character-preview-attr-label">STR</span>
            <span className="character-preview-attr-value">{character.abilities.strength}</span>
          </div>
          <div className="character-preview-attr">
            <span className="character-preview-attr-label">DEX</span>
            <span className="character-preview-attr-value">{character.abilities.dexterity}</span>
          </div>
          <div className="character-preview-attr">
            <span className="character-preview-attr-label">CON</span>
            <span className="character-preview-attr-value">{character.abilities.constitution}</span>
          </div>
          <div className="character-preview-attr">
            <span className="character-preview-attr-label">INT</span>
            <span className="character-preview-attr-value">{character.abilities.intelligence}</span>
          </div>
          <div className="character-preview-attr">
            <span className="character-preview-attr-label">WIS</span>
            <span className="character-preview-attr-value">{character.abilities.wisdom}</span>
          </div>
          <div className="character-preview-attr">
            <span className="character-preview-attr-label">CHA</span>
            <span className="character-preview-attr-value">{character.abilities.charisma}</span>
          </div>
        </div>
      </section>

      <section className="character-preview-section">
        <h4 className="character-preview-section-title">Combat</h4>
        <div className="character-preview-attr-grid">
          <div className="character-preview-attr">
            <span className="character-preview-attr-label">HP</span>
            <span className="character-preview-attr-value">{character.derived.hitPoints}</span>
          </div>
          <div className="character-preview-attr">
            <span className="character-preview-attr-label">AC</span>
            <span className="character-preview-attr-value">{character.derived.armorClass}</span>
          </div>
          <div className="character-preview-attr">
            <span className="character-preview-attr-label">Speed</span>
            <span className="character-preview-attr-value">{character.derived.speed}</span>
          </div>
          <div className="character-preview-attr">
            <span className="character-preview-attr-label">Perc</span>
            <span className="character-preview-attr-value">{character.derived.perception}</span>
          </div>
        </div>
      </section>

      {character.skills.length > 0 && (
        <section className="character-preview-section">
          <h4 className="character-preview-section-title">Skills</h4>
          <ul className="character-preview-skill-list">
            {character.skills
              .filter(s => s.proficiency !== 'untrained')
              .slice(0, 5)
              .map(skill => (
                <li key={skill.id} className="character-preview-skill">
                  <span className="character-preview-skill-name">{skill.name}</span>
                  <span className="character-preview-skill-prof" data-prof={skill.proficiency}>
                    {skill.proficiency[0].toUpperCase()}
                  </span>
                </li>
              ))}
          </ul>
        </section>
      )}

      {character.weapons.length > 0 && (
        <section className="character-preview-section">
          <h4 className="character-preview-section-title">Weapons</h4>
          <ul className="character-preview-equip-list">
            {character.weapons.map(w => (
              <li key={w.id} className="character-preview-equip">
                <span className="character-preview-equip-name">{w.name}</span>
                <span className="character-preview-equip-detail">{w.damage}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {character.armor && (
        <section className="character-preview-section">
          <h4 className="character-preview-section-title">Armor</h4>
          <div className="character-preview-equip">
            <span className="character-preview-equip-name">{character.armor.name}</span>
            <span className="character-preview-equip-detail">+{character.armor.acBonus} AC</span>
          </div>
        </section>
      )}
    </>
  )
}

const getCharacterSummary = (character: CharacterSheet): string => {
  if (isGurpsCharacter(character)) {
    return `HP ${character.derived.hitPoints} · Move ${character.derived.basicMove} · ${character.pointsTotal} pts`
  }
  if (isPF2Character(character)) {
    return `${character.class} ${character.level} · HP ${character.derived.hitPoints} · AC ${character.derived.armorClass}`
  }
  return ''
}

export const CharacterPreview = ({
  characters,
  selectedCharacterId,
  rulesetId,
  currentUserId,
  onSelectCharacter,
  onNavigateToArmory,
}: CharacterPreviewProps) => {
  const [showPicker, setShowPicker] = useState(!selectedCharacterId)
  const [statsExpanded, setStatsExpanded] = useState(false)
  const isMobile = useIsMobile()

  void currentUserId

  const toggleStats = useCallback(() => setStatsExpanded(prev => !prev), [])

  const selectedCharacter = characters.find(c => c.id === selectedCharacterId) ?? null

  if (!selectedCharacter || showPicker) {
    return (
      <div className="character-preview">
        <div className="character-preview-prompt">
          <h3 className="character-preview-prompt-title">Choose your character</h3>
          <p className="character-preview-prompt-subtitle">
            Select a character for this match
          </p>
        </div>
        <CharacterPicker
          characters={characters}
          rulesetId={rulesetId}
          selectedCharacterId={selectedCharacterId}
          onSelect={(id) => {
            onSelectCharacter(id)
            setShowPicker(false)
          }}
          onQuickCreate={onNavigateToArmory}
        />
        {selectedCharacter && (
          <button
            className="character-preview-btn-cancel"
            onClick={() => setShowPicker(false)}
            type="button"
          >
            Cancel
          </button>
        )}
      </div>
    )
  }

  const rulesetLabel = rulesetId === 'gurps' ? 'GURPS' : 'PF2'
  const showStats = !isMobile || statsExpanded

  return (
    <div className="character-preview">
      <header className="character-preview-header">
        <div className="character-preview-identity">
          <h3 className="character-preview-name">{selectedCharacter.name}</h3>
          <span className={`character-preview-badge ruleset-${rulesetId}`}>
            {rulesetLabel}
          </span>
        </div>
        {isMobile && (
          <button
            className="character-preview-summary-toggle"
            onClick={toggleStats}
            type="button"
          >
            <span className="character-preview-summary-text">
              {getCharacterSummary(selectedCharacter)}
            </span>
            <span className={`character-preview-chevron ${statsExpanded ? 'character-preview-chevron--up' : ''}`}>
              ▾
            </span>
          </button>
        )}
        <div className="character-preview-actions">
          <button
            className="character-preview-btn-change"
            onClick={() => setShowPicker(true)}
            type="button"
          >
            Change Character
          </button>
          <button
            className="character-preview-btn-edit"
            onClick={onNavigateToArmory}
            type="button"
          >
            Edit in Armory
          </button>
        </div>
      </header>

      {showStats && (
        <div className="character-preview-stats">
          {isGurpsCharacter(selectedCharacter) && <GurpsStats character={selectedCharacter} />}
          {isPF2Character(selectedCharacter) && <PF2Stats character={selectedCharacter} />}
        </div>
      )}
    </div>
  )
}
