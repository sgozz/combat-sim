import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { rulesets } from '../../../shared/rulesets'
import { isGurpsCharacter, isPF2Character } from '../../../shared/rulesets/characterSheet'
import type { CharacterSheet, RulesetId } from '../../../shared/types'
import type { GurpsCharacterSheet } from '../../../shared/rulesets/gurps/characterSheet'
import type { PF2CharacterSheet } from '../../../shared/rulesets/pf2/characterSheet'
import './CharacterEditor.css'

type Tab = 'attributes' | 'skills' | 'equipment' | 'traits'

type CharacterEditorProps = {
  characters: CharacterSheet[]
  onSaveCharacter: (character: CharacterSheet) => void
  defaultRulesetId?: RulesetId
}

export const CharacterEditor = ({ characters, onSaveCharacter, defaultRulesetId = 'gurps' }: CharacterEditorProps) => {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isNew = !id || id === 'new'

  const [activeTab, setActiveTab] = useState<Tab>('attributes')
  const [character, setCharacter] = useState<CharacterSheet | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (isNew) {
      const rulesetId: RulesetId = defaultRulesetId
      const bundle = rulesets[rulesetId]
      if (bundle) {
        const newChar = bundle.ruleset.createCharacter('New Character')
        setCharacter(newChar)
      }
    } else {
      const existing = characters.find(c => c.id === id)
      if (existing) {
        setCharacter(existing)
      } else {
        navigate('/armory')
      }
    }
  }, [id, isNew, characters, navigate, defaultRulesetId])

  if (!character) {
    return (
      <div className="editor-loading">
        <span className="editor-loading-text">Loading...</span>
      </div>
    )
  }

  const handleSave = () => {
    setIsSaving(true)
    onSaveCharacter(character)
    navigate('/armory')
  }

  const handleCancel = () => {
    navigate('/armory')
  }

  const updateName = (name: string) => {
    setCharacter({ ...character, name })
  }

  const updateGurpsAttribute = (key: keyof GurpsCharacterSheet['attributes'], value: number) => {
    if (isGurpsCharacter(character)) {
      setCharacter({
        ...character,
        attributes: { ...character.attributes, [key]: value },
      })
    }
  }

  const updateGurpsDerived = (key: keyof GurpsCharacterSheet['derived'], value: number) => {
    if (isGurpsCharacter(character)) {
      setCharacter({
        ...character,
        derived: { ...character.derived, [key]: value },
      })
    }
  }

  const updatePF2Ability = (key: keyof PF2CharacterSheet['abilities'], value: number) => {
    if (isPF2Character(character)) {
      setCharacter({
        ...character,
        abilities: { ...character.abilities, [key]: value },
      })
    }
  }

  const updatePF2Field = <K extends keyof PF2CharacterSheet>(key: K, value: PF2CharacterSheet[K]) => {
    if (isPF2Character(character)) {
      setCharacter({ ...character, [key]: value })
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'attributes', label: 'Attributes' },
    { id: 'skills', label: 'Skills' },
    { id: 'equipment', label: 'Equipment' },
    { id: 'traits', label: 'Traits' },
  ]

  return (
    <div className="character-editor">
      <header className="editor-header">
        <button onClick={handleCancel} className="editor-btn-back" aria-label="Go back">
          ← Back
        </button>

        <input
          type="text"
          value={character.name}
          onChange={(e) => updateName(e.target.value)}
          className="editor-name-input"
          placeholder="Character Name"
          autoFocus={isNew}
        />

        <div className="editor-header-actions">
          <span className={`editor-ruleset-badge ruleset-${character.rulesetId}`}>
            {character.rulesetId === 'gurps' ? 'GURPS' : 'PF2'}
          </span>
          <button onClick={handleCancel} className="editor-btn-cancel">
            Cancel
          </button>
          <button onClick={handleSave} className="editor-btn-save" disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </header>

      <nav className="editor-tabs" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`editor-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main className="editor-content">
        {activeTab === 'attributes' && (
          <div className="editor-tab-panel" role="tabpanel">
            {isGurpsCharacter(character) && (
              <GurpsAttributesPanel
                character={character}
                onUpdateAttribute={updateGurpsAttribute}
                onUpdateDerived={updateGurpsDerived}
              />
            )}
            {isPF2Character(character) && (
              <PF2AttributesPanel
                character={character}
                onUpdateAbility={updatePF2Ability}
                onUpdateField={updatePF2Field}
              />
            )}
          </div>
        )}

        {activeTab === 'skills' && (
          <div className="editor-tab-panel" role="tabpanel">
            <div className="editor-placeholder">
              <span className="editor-placeholder-icon">📜</span>
              <p className="editor-placeholder-text">Skills editor coming soon</p>
            </div>
          </div>
        )}

        {activeTab === 'equipment' && (
          <div className="editor-tab-panel" role="tabpanel">
            <div className="editor-placeholder">
              <span className="editor-placeholder-icon">⚔️</span>
              <p className="editor-placeholder-text">Equipment editor coming soon</p>
            </div>
          </div>
        )}

        {activeTab === 'traits' && (
          <div className="editor-tab-panel" role="tabpanel">
            <div className="editor-placeholder">
              <span className="editor-placeholder-icon">✨</span>
              <p className="editor-placeholder-text">Traits editor coming soon</p>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

/* ─── GURPS Attributes Panel ─── */

type GurpsAttributesPanelProps = {
  character: GurpsCharacterSheet
  onUpdateAttribute: (key: keyof GurpsCharacterSheet['attributes'], value: number) => void
  onUpdateDerived: (key: keyof GurpsCharacterSheet['derived'], value: number) => void
}

const GurpsAttributesPanel = ({ character, onUpdateAttribute, onUpdateDerived }: GurpsAttributesPanelProps) => {
  const primaryAttrs: { key: keyof GurpsCharacterSheet['attributes']; label: string; abbr: string }[] = [
    { key: 'strength', label: 'Strength', abbr: 'ST' },
    { key: 'dexterity', label: 'Dexterity', abbr: 'DX' },
    { key: 'intelligence', label: 'Intelligence', abbr: 'IQ' },
    { key: 'health', label: 'Health', abbr: 'HT' },
  ]

  const derivedStats: { key: keyof GurpsCharacterSheet['derived']; label: string; abbr: string }[] = [
    { key: 'hitPoints', label: 'Hit Points', abbr: 'HP' },
    { key: 'fatiguePoints', label: 'Fatigue Points', abbr: 'FP' },
    { key: 'basicSpeed', label: 'Basic Speed', abbr: 'Spd' },
    { key: 'basicMove', label: 'Basic Move', abbr: 'Mv' },
    { key: 'dodge', label: 'Dodge', abbr: 'Dg' },
  ]

  return (
    <div className="editor-attributes-section">
      <div className="editor-section-group">
        <h3 className="editor-section-title">Primary Attributes</h3>
        <div className="editor-attr-grid">
          {primaryAttrs.map(({ key, label, abbr }) => (
            <div key={key} className="editor-attr-card">
              <span className="editor-attr-abbr">{abbr}</span>
              <span className="editor-attr-label">{label}</span>
              <input
                type="number"
                className="editor-attr-input"
                value={character.attributes[key] ?? 10}
                onChange={(e) => onUpdateAttribute(key, parseInt(e.target.value) || 10)}
                min={1}
                max={30}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="editor-section-group">
        <h3 className="editor-section-title">Derived Stats</h3>
        <div className="editor-attr-grid">
          {derivedStats.map(({ key, label, abbr }) => (
            <div key={key} className="editor-attr-card derived">
              <span className="editor-attr-abbr">{abbr}</span>
              <span className="editor-attr-label">{label}</span>
              <input
                type="number"
                className="editor-attr-input"
                value={character.derived[key]}
                onChange={(e) => onUpdateDerived(key, parseFloat(e.target.value) || 0)}
                min={0}
                step={key === 'basicSpeed' ? 0.25 : 1}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="editor-section-group">
        <h3 className="editor-section-title">Point Total</h3>
        <div className="editor-points-display">
          <span className="editor-points-value">{character.pointsTotal}</span>
          <span className="editor-points-label">points</span>
        </div>
      </div>
    </div>
  )
}

/* ─── PF2 Attributes Panel ─── */

type PF2AttributesPanelProps = {
  character: PF2CharacterSheet
  onUpdateAbility: (key: keyof PF2CharacterSheet['abilities'], value: number) => void
  onUpdateField: <K extends keyof PF2CharacterSheet>(key: K, value: PF2CharacterSheet[K]) => void
}

const PF2AttributesPanel = ({ character, onUpdateAbility, onUpdateField }: PF2AttributesPanelProps) => {
  const abilities: { key: keyof PF2CharacterSheet['abilities']; label: string; abbr: string }[] = [
    { key: 'strength', label: 'Strength', abbr: 'Str' },
    { key: 'dexterity', label: 'Dexterity', abbr: 'Dex' },
    { key: 'constitution', label: 'Constitution', abbr: 'Con' },
    { key: 'intelligence', label: 'Intelligence', abbr: 'Int' },
    { key: 'wisdom', label: 'Wisdom', abbr: 'Wis' },
    { key: 'charisma', label: 'Charisma', abbr: 'Cha' },
  ]

  return (
    <div className="editor-attributes-section">
      <div className="editor-section-group">
        <h3 className="editor-section-title">Character Info</h3>
        <div className="editor-info-grid">
          <div className="editor-info-field">
            <label className="editor-field-label">Level</label>
            <input
              type="number"
              className="editor-field-input"
              value={character.level}
              onChange={(e) => onUpdateField('level', parseInt(e.target.value) || 1)}
              min={1}
              max={20}
            />
          </div>
          <div className="editor-info-field">
            <label className="editor-field-label">Class</label>
            <input
              type="text"
              className="editor-field-input"
              value={character.class}
              onChange={(e) => onUpdateField('class', e.target.value)}
              placeholder="Fighter, Wizard..."
            />
          </div>
          <div className="editor-info-field">
            <label className="editor-field-label">Ancestry</label>
            <input
              type="text"
              className="editor-field-input"
              value={character.ancestry}
              onChange={(e) => onUpdateField('ancestry', e.target.value)}
              placeholder="Human, Elf..."
            />
          </div>
          <div className="editor-info-field">
            <label className="editor-field-label">Max HP</label>
            <input
              type="number"
              className="editor-field-input"
              value={character.derived.hitPoints}
              onChange={(e) => onUpdateField('derived', {
                ...character.derived,
                hitPoints: parseInt(e.target.value) || 1,
              })}
              min={1}
            />
          </div>
        </div>
      </div>

      <div className="editor-section-group">
        <h3 className="editor-section-title">Ability Scores</h3>
        <div className="editor-attr-grid">
          {abilities.map(({ key, label, abbr }) => (
            <div key={key} className="editor-attr-card">
              <span className="editor-attr-abbr">{abbr}</span>
              <span className="editor-attr-label">{label}</span>
              <input
                type="number"
                className="editor-attr-input"
                value={character.abilities[key]}
                onChange={(e) => onUpdateAbility(key, parseInt(e.target.value) || 10)}
                min={1}
                max={30}
              />
              <span className="editor-attr-modifier">
                {Math.floor((character.abilities[key] - 10) / 2) >= 0 ? '+' : ''}
                {Math.floor((character.abilities[key] - 10) / 2)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="editor-section-group">
        <h3 className="editor-section-title">Derived Stats</h3>
        <div className="editor-derived-row">
          <div className="editor-derived-chip">
            <span className="editor-derived-label">AC</span>
            <span className="editor-derived-value">{character.derived.armorClass}</span>
          </div>
          <div className="editor-derived-chip">
            <span className="editor-derived-label">Speed</span>
            <span className="editor-derived-value">{character.derived.speed} ft</span>
          </div>
          <div className="editor-derived-chip">
            <span className="editor-derived-label">Fort</span>
            <span className="editor-derived-value">+{character.derived.fortitudeSave}</span>
          </div>
          <div className="editor-derived-chip">
            <span className="editor-derived-label">Ref</span>
            <span className="editor-derived-value">+{character.derived.reflexSave}</span>
          </div>
          <div className="editor-derived-chip">
            <span className="editor-derived-label">Will</span>
            <span className="editor-derived-value">+{character.derived.willSave}</span>
          </div>
          <div className="editor-derived-chip">
            <span className="editor-derived-label">Per</span>
            <span className="editor-derived-value">+{character.derived.perception}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
