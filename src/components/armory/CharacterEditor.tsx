import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { generateUUID } from '../../../shared/utils/uuid'
import { rulesets } from '../../../shared/rulesets'
import { isGurpsCharacter, isPF2Character } from '../../../shared/rulesets/characterSheet'
import { PathbuilderImport } from '../rulesets/pf2/PathbuilderImport'
import type { CharacterSheet, RulesetId } from '../../../shared/types'
import type { GurpsCharacterSheet } from '../../../shared/rulesets/gurps/characterSheet'
import type { PF2CharacterSheet } from '../../../shared/rulesets/pf2/characterSheet'
import type { PF2CharacterWeapon, PF2CharacterArmor } from '../../../shared/rulesets/pf2/characterSheet'
import type { Skill, Equipment, DamageType, Reach, EquipmentType, Advantage, Disadvantage } from '../../../shared/rulesets/gurps/types'
import type { PF2Skill, Proficiency, PF2DamageType, PF2WeaponTrait } from '../../../shared/rulesets/pf2/types'
import type { Abilities } from '../../../shared/rulesets/pf2/types'
import type { PF2Feat } from '../../../shared/rulesets/pf2/characterSheet'
import { MODEL_LIST, DEFAULT_MODEL_ID } from '../../data/modelRegistry'
import './CharacterEditor.css'

type Tab = 'attributes' | 'skills' | 'equipment' | 'traits'

type CharacterEditorProps = {
  characters: CharacterSheet[]
  onSaveCharacter: (character: CharacterSheet) => void
  preferredRulesetId?: RulesetId
}

export const CharacterEditor = ({ characters, onSaveCharacter, preferredRulesetId = 'gurps' }: CharacterEditorProps) => {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isNew = !id || id === 'new'

  const [activeTab, setActiveTab] = useState<Tab>('attributes')
  const [character, setCharacter] = useState<CharacterSheet | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [showPathbuilderImport, setShowPathbuilderImport] = useState(false)

  useEffect(() => {
    if (isNew) {
      const bundle = rulesets[preferredRulesetId]
      if (bundle) {
        const newChar = bundle.ruleset.createCharacter('New Character')
        queueMicrotask(() => setCharacter(newChar))
      }
    } else {
      if (characters.length === 0) return
      const existing = characters.find(c => c.id === id)
      if (existing) {
        queueMicrotask(() => setCharacter(existing))
      } else {
        navigate('/armory')
      }
    }
  }, [id, isNew, characters, navigate, preferredRulesetId])

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
          {character.rulesetId === 'pf2' && (
            <button
              onClick={() => setShowPathbuilderImport(true)}
              className="editor-btn-import"
              title="Import character from Pathbuilder 2e"
            >
              ↓ Import from Pathbuilder
            </button>
          )}
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

            <div className="editor-section-group" style={{ marginTop: 'var(--space-xl)' }}>
              <h3 className="editor-section-title">3D Model</h3>
              <div className="editor-model-picker">
                {MODEL_LIST.map((model) => (
                  <button
                    key={model.id}
                    type="button"
                    className={`editor-model-option${(character.modelId ?? DEFAULT_MODEL_ID) === model.id ? ' active' : ''}`}
                    onClick={() => setCharacter({ ...character, modelId: model.id })}
                  >
                    <span className="editor-model-label">{model.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'skills' && (
          <div className="editor-tab-panel" role="tabpanel">
            {isGurpsCharacter(character) && (
              <GurpsSkillsPanel
                character={character}
                onUpdateSkills={(skills) => setCharacter({ ...character, skills })}
              />
            )}
            {isPF2Character(character) && (
              <PF2SkillsPanel
                character={character}
                onUpdateSkills={(skills) => setCharacter({ ...character, skills })}
              />
            )}
          </div>
        )}

        {activeTab === 'equipment' && (
          <div className="editor-tab-panel" role="tabpanel">
            {isGurpsCharacter(character) && (
              <GurpsEquipmentPanel
                character={character}
                onUpdateEquipment={(equipment) => setCharacter({ ...character, equipment })}
              />
            )}
            {isPF2Character(character) && (
              <PF2EquipmentPanel
                character={character}
                onUpdateWeapons={(weapons) => setCharacter({ ...character, weapons })}
                onUpdateArmor={(armor) => setCharacter({ ...character, armor })}
                onUpdateShield={(shieldBonus) => setCharacter({ ...character, shieldBonus })}
              />
            )}
          </div>
        )}

        {activeTab === 'traits' && (
          <div className="editor-tab-panel" role="tabpanel">
            {isGurpsCharacter(character) && (
              <GurpsTraitsPanel
                character={character}
                onUpdateAdvantages={(advantages) => setCharacter({ ...character, advantages })}
                onUpdateDisadvantages={(disadvantages) => setCharacter({ ...character, disadvantages })}
              />
            )}
            {isPF2Character(character) && (
              <PF2TraitsPanel
                character={character}
                onUpdateFeats={(feats) => setCharacter({ ...character, feats })}
              />
            )}
          </div>
        )}
      </main>

      {showPathbuilderImport && (
        <PathbuilderImport
          onImport={(imported) => {
            setCharacter({ ...imported, id: character.id })
            setShowPathbuilderImport(false)
          }}
          onCancel={() => setShowPathbuilderImport(false)}
        />
      )}
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

/* ─── GURPS Skills Panel ─── */

const GURPS_COMMON_SKILLS = [
  'Broadsword', 'Shield', 'Knife', 'Bow', 'Crossbow', 'Spear', 'Axe/Mace',
  'Brawling', 'Wrestling', 'Stealth', 'Climbing', 'Swimming', 'First Aid',
  'Tactics', 'Strategy', 'Shortsword', 'Two-Handed Sword', 'Staff', 'Karate',
  'Judo',
]

type GurpsSkillsPanelProps = {
  character: GurpsCharacterSheet
  onUpdateSkills: (skills: Skill[]) => void
}

const GurpsSkillsPanel = ({ character, onUpdateSkills }: GurpsSkillsPanelProps) => {
  const [newSkillName, setNewSkillName] = useState('')
  const [newSkillLevel, setNewSkillLevel] = useState(10)

  const addSkill = useCallback(() => {
    const name = newSkillName.trim()
    if (!name) return
    if (character.skills.some(s => s.name.toLowerCase() === name.toLowerCase())) return
    const skill: Skill = {
      id: generateUUID(),
      name,
      level: newSkillLevel,
    }
    onUpdateSkills([...character.skills, skill])
    setNewSkillName('')
    setNewSkillLevel(10)
  }, [newSkillName, newSkillLevel, character.skills, onUpdateSkills])

  const removeSkill = useCallback((skillId: string) => {
    onUpdateSkills(character.skills.filter(s => s.id !== skillId))
  }, [character.skills, onUpdateSkills])

  const updateSkillLevel = useCallback((skillId: string, level: number) => {
    onUpdateSkills(character.skills.map(s => s.id === skillId ? { ...s, level } : s))
  }, [character.skills, onUpdateSkills])

  return (
    <div className="editor-skills-section">
      <div className="editor-section-group">
        <h3 className="editor-section-title">Add Skill</h3>
        <div className="editor-skill-add-form">
          <div className="editor-skill-add-field editor-skill-add-field--name">
            <label className="editor-field-label">Skill Name</label>
            <input
              type="text"
              className="editor-field-input"
              value={newSkillName}
              onChange={(e) => setNewSkillName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addSkill() }}
              placeholder="e.g. Broadsword"
              list="gurps-skills-list"
            />
            <datalist id="gurps-skills-list">
              {GURPS_COMMON_SKILLS
                .filter(s => !character.skills.some(existing => existing.name.toLowerCase() === s.toLowerCase()))
                .map(s => <option key={s} value={s} />)}
            </datalist>
          </div>
          <div className="editor-skill-add-field editor-skill-add-field--level">
            <label className="editor-field-label">Level</label>
            <input
              type="number"
              className="editor-field-input"
              value={newSkillLevel}
              onChange={(e) => setNewSkillLevel(parseInt(e.target.value) || 10)}
              min={1}
              max={30}
            />
          </div>
          <button
            className="editor-skill-add-btn"
            onClick={addSkill}
            disabled={!newSkillName.trim()}
            aria-label="Add skill"
          >
            + Add
          </button>
        </div>
      </div>

      <div className="editor-section-group">
        <h3 className="editor-section-title">Skills ({character.skills.length})</h3>
        {character.skills.length === 0 ? (
          <p className="editor-skills-empty">No skills added yet. Use the form above to add skills.</p>
        ) : (
          <div className="editor-skills-list">
            {character.skills.map((skill) => (
              <div key={skill.id} className="editor-skill-row">
                <span className="editor-skill-name">{skill.name}</span>
                <div className="editor-skill-controls">
                  <label className="editor-skill-level-label">Lvl</label>
                  <input
                    type="number"
                    className="editor-skill-level-input"
                    value={skill.level}
                    onChange={(e) => updateSkillLevel(skill.id, parseInt(e.target.value) || 1)}
                    min={1}
                    max={30}
                  />
                  <button
                    className="editor-skill-remove-btn"
                    onClick={() => removeSkill(skill.id)}
                    aria-label={`Remove ${skill.name}`}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── PF2 Skills Panel ─── */

const PF2_COMMON_SKILLS = [
  'Athletics', 'Acrobatics', 'Stealth', 'Thievery', 'Arcana', 'Nature',
  'Religion', 'Occultism', 'Society', 'Medicine', 'Survival', 'Perception',
  'Diplomacy', 'Intimidation', 'Deception', 'Performance', 'Crafting',
  'Lore (Warfare)', 'Lore (Academia)', 'Lore (Underworld)',
]

const PF2_ABILITIES: { key: keyof Abilities; label: string }[] = [
  { key: 'strength', label: 'Str' },
  { key: 'dexterity', label: 'Dex' },
  { key: 'constitution', label: 'Con' },
  { key: 'intelligence', label: 'Int' },
  { key: 'wisdom', label: 'Wis' },
  { key: 'charisma', label: 'Cha' },
]

const PF2_PROFICIENCIES: { value: Proficiency; label: string }[] = [
  { value: 'untrained', label: 'Untrained' },
  { value: 'trained', label: 'Trained' },
  { value: 'expert', label: 'Expert' },
  { value: 'master', label: 'Master' },
  { value: 'legendary', label: 'Legendary' },
]

type PF2SkillsPanelProps = {
  character: PF2CharacterSheet
  onUpdateSkills: (skills: PF2Skill[]) => void
}

const PF2SkillsPanel = ({ character, onUpdateSkills }: PF2SkillsPanelProps) => {
  const [newSkillName, setNewSkillName] = useState('')
  const [newSkillAbility, setNewSkillAbility] = useState<keyof Abilities>('strength')
  const [newSkillProficiency, setNewSkillProficiency] = useState<Proficiency>('trained')

  const addSkill = useCallback(() => {
    const name = newSkillName.trim()
    if (!name) return
    if (character.skills.some(s => s.name.toLowerCase() === name.toLowerCase())) return
    const skill: PF2Skill = {
      id: generateUUID(),
      name,
      ability: newSkillAbility,
      proficiency: newSkillProficiency,
    }
    onUpdateSkills([...character.skills, skill])
    setNewSkillName('')
    setNewSkillAbility('strength')
    setNewSkillProficiency('trained')
  }, [newSkillName, newSkillAbility, newSkillProficiency, character.skills, onUpdateSkills])

  const removeSkill = useCallback((skillId: string) => {
    onUpdateSkills(character.skills.filter(s => s.id !== skillId))
  }, [character.skills, onUpdateSkills])

  const updateSkillProficiency = useCallback((skillId: string, proficiency: Proficiency) => {
    onUpdateSkills(character.skills.map(s => s.id === skillId ? { ...s, proficiency } : s))
  }, [character.skills, onUpdateSkills])

  return (
    <div className="editor-skills-section">
      <div className="editor-section-group">
        <h3 className="editor-section-title">Add Skill</h3>
        <div className="editor-skill-add-form editor-skill-add-form--pf2">
          <div className="editor-skill-add-field editor-skill-add-field--name">
            <label className="editor-field-label">Skill Name</label>
            <input
              type="text"
              className="editor-field-input"
              value={newSkillName}
              onChange={(e) => setNewSkillName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addSkill() }}
              placeholder="e.g. Athletics"
              list="pf2-skills-list"
            />
            <datalist id="pf2-skills-list">
              {PF2_COMMON_SKILLS
                .filter(s => !character.skills.some(existing => existing.name.toLowerCase() === s.toLowerCase()))
                .map(s => <option key={s} value={s} />)}
            </datalist>
          </div>
          <div className="editor-skill-add-field editor-skill-add-field--ability">
            <label className="editor-field-label">Ability</label>
            <select
              className="editor-field-input editor-field-select"
              value={newSkillAbility}
              onChange={(e) => setNewSkillAbility(e.target.value as keyof Abilities)}
            >
              {PF2_ABILITIES.map(a => (
                <option key={a.key} value={a.key}>{a.label}</option>
              ))}
            </select>
          </div>
          <div className="editor-skill-add-field editor-skill-add-field--proficiency">
            <label className="editor-field-label">Proficiency</label>
            <select
              className="editor-field-input editor-field-select"
              value={newSkillProficiency}
              onChange={(e) => setNewSkillProficiency(e.target.value as Proficiency)}
            >
              {PF2_PROFICIENCIES.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          <button
            className="editor-skill-add-btn"
            onClick={addSkill}
            disabled={!newSkillName.trim()}
            aria-label="Add skill"
          >
            + Add
          </button>
        </div>
      </div>

      <div className="editor-section-group">
        <h3 className="editor-section-title">Skills ({character.skills.length})</h3>
        {character.skills.length === 0 ? (
          <p className="editor-skills-empty">No skills added yet. Use the form above to add skills.</p>
        ) : (
          <div className="editor-skills-list">
            {character.skills.map((skill) => (
              <div key={skill.id} className="editor-skill-row editor-skill-row--pf2">
                <span className="editor-skill-name">{skill.name}</span>
                <span className="editor-skill-ability-badge">
                  {PF2_ABILITIES.find(a => a.key === skill.ability)?.label ?? skill.ability}
                </span>
                <div className="editor-skill-controls">
                  <select
                    className="editor-skill-proficiency-select"
                    value={skill.proficiency}
                    onChange={(e) => updateSkillProficiency(skill.id, e.target.value as Proficiency)}
                  >
                    {PF2_PROFICIENCIES.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                  <button
                    className="editor-skill-remove-btn"
                    onClick={() => removeSkill(skill.id)}
                    aria-label={`Remove ${skill.name}`}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── GURPS Equipment Panel ─── */

type GurpsWeaponPreset = {
  name: string
  damage: string
  damageType: DamageType
  type: EquipmentType
  reach?: Reach
  parry?: number
  skillUsed?: string
}

const GURPS_WEAPON_PRESETS: GurpsWeaponPreset[] = [
  { name: 'Broadsword', damage: 'sw+1', damageType: 'cutting', type: 'melee', reach: '1', parry: 0, skillUsed: 'Broadsword' },
  { name: 'Shortsword', damage: 'sw-1', damageType: 'cutting', type: 'melee', reach: '1', parry: 0, skillUsed: 'Shortsword' },
  { name: 'Thrusting Broadsword', damage: 'thr+2', damageType: 'impaling', type: 'melee', reach: '1', parry: 0, skillUsed: 'Broadsword' },
  { name: 'Bastard Sword (2H)', damage: 'sw+2', damageType: 'cutting', type: 'melee', reach: '1,2', parry: 0, skillUsed: 'Two-Handed Sword' },
  { name: 'Greatsword', damage: 'sw+3', damageType: 'cutting', type: 'melee', reach: '1,2', parry: 0, skillUsed: 'Two-Handed Sword' },
  { name: 'Spear (1H)', damage: 'thr+2', damageType: 'impaling', type: 'melee', reach: '1', parry: 0, skillUsed: 'Spear' },
  { name: 'Spear (2H)', damage: 'thr+3', damageType: 'impaling', type: 'melee', reach: '1,2', parry: 0, skillUsed: 'Spear' },
  { name: 'Knife', damage: 'thr-1', damageType: 'impaling', type: 'melee', reach: 'C', parry: -1, skillUsed: 'Knife' },
  { name: 'Large Knife', damage: 'sw-2', damageType: 'cutting', type: 'melee', reach: 'C,1', parry: -1, skillUsed: 'Knife' },
  { name: 'Axe', damage: 'sw+2', damageType: 'cutting', type: 'melee', reach: '1', parry: 0, skillUsed: 'Axe/Mace' },
  { name: 'Mace', damage: 'sw+2', damageType: 'crushing', type: 'melee', reach: '1', parry: 0, skillUsed: 'Axe/Mace' },
  { name: 'Quarterstaff', damage: 'sw+2', damageType: 'crushing', type: 'melee', reach: '1,2', parry: 2, skillUsed: 'Staff' },
  { name: 'Halberd', damage: 'sw+3', damageType: 'cutting', type: 'melee', reach: '2,3', parry: 0, skillUsed: 'Two-Handed Sword' },
  { name: 'Bow', damage: 'thr+1', damageType: 'impaling', type: 'ranged', skillUsed: 'Bow' },
  { name: 'Crossbow', damage: 'thr+4', damageType: 'impaling', type: 'ranged', skillUsed: 'Crossbow' },
]

const GURPS_ARMOR_PRESETS = [
  { name: 'Cloth Armor', dr: 1 },
  { name: 'Leather Armor', dr: 2 },
  { name: 'Light Scale', dr: 3 },
  { name: 'Mail', dr: 4 },
  { name: 'Heavy Mail', dr: 5 },
  { name: 'Light Plate', dr: 6 },
  { name: 'Heavy Plate', dr: 7 },
]

const GURPS_DAMAGE_TYPES: DamageType[] = ['crushing', 'cutting', 'impaling', 'piercing']

type GurpsEquipmentPanelProps = {
  character: GurpsCharacterSheet
  onUpdateEquipment: (equipment: Equipment[]) => void
}

const GurpsEquipmentPanel = ({ character, onUpdateEquipment }: GurpsEquipmentPanelProps) => {
  const [weaponName, setWeaponName] = useState('')
  const [weaponDamage, setWeaponDamage] = useState('')
  const [weaponDamageType, setWeaponDamageType] = useState<DamageType>('crushing')
  const [weaponReach, setWeaponReach] = useState<Reach>('1')
  const [weaponParry, setWeaponParry] = useState(0)
  const [weaponType, setWeaponType] = useState<EquipmentType>('melee')

  const weapons = character.equipment.filter(e => e.type === 'melee' || e.type === 'ranged')
  const armor = character.equipment.find(e => e.type === 'armor')

  const handleWeaponNameChange = useCallback((name: string) => {
    setWeaponName(name)
    const preset = GURPS_WEAPON_PRESETS.find(p => p.name.toLowerCase() === name.toLowerCase())
    if (preset) {
      setWeaponDamage(preset.damage)
      setWeaponDamageType(preset.damageType)
      setWeaponType(preset.type)
      if (preset.reach) setWeaponReach(preset.reach)
      if (preset.parry !== undefined) setWeaponParry(preset.parry)
    }
  }, [])

  const addWeapon = useCallback(() => {
    const name = weaponName.trim()
    if (!name) return
    const weapon: Equipment = {
      id: generateUUID(),
      name,
      type: weaponType,
      damage: weaponDamage || undefined,
      damageType: weaponDamageType,
      reach: weaponType === 'melee' ? weaponReach : undefined,
      parry: weaponType === 'melee' ? weaponParry : undefined,
    }
    onUpdateEquipment([...character.equipment, weapon])
    setWeaponName('')
    setWeaponDamage('')
    setWeaponDamageType('crushing')
    setWeaponReach('1')
    setWeaponParry(0)
    setWeaponType('melee')
  }, [weaponName, weaponDamage, weaponDamageType, weaponReach, weaponParry, weaponType, character.equipment, onUpdateEquipment])

  const removeItem = useCallback((itemId: string) => {
    onUpdateEquipment(character.equipment.filter(e => e.id !== itemId))
  }, [character.equipment, onUpdateEquipment])

  const setArmor = useCallback((presetName: string) => {
    const preset = GURPS_ARMOR_PRESETS.find(a => a.name === presetName)
    const withoutArmor = character.equipment.filter(e => e.type !== 'armor')
    if (!preset) {
      onUpdateEquipment(withoutArmor)
      return
    }
    const armorItem: Equipment = {
      id: generateUUID(),
      name: preset.name,
      type: 'armor',
      dr: preset.dr,
    }
    onUpdateEquipment([...withoutArmor, armorItem])
  }, [character.equipment, onUpdateEquipment])

  return (
    <div className="editor-equipment-section">
      <div className="editor-section-group">
        <h3 className="editor-section-title">Add Weapon</h3>
        <div className="editor-equip-add-form">
          <div className="editor-equip-field editor-equip-field--name">
            <label className="editor-field-label">Weapon</label>
            <input
              type="text"
              className="editor-field-input"
              value={weaponName}
              onChange={(e) => handleWeaponNameChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addWeapon() }}
              placeholder="e.g. Broadsword"
              list="gurps-weapons-list"
            />
            <datalist id="gurps-weapons-list">
              {GURPS_WEAPON_PRESETS
                .filter(p => !weapons.some(w => w.name.toLowerCase() === p.name.toLowerCase()))
                .map(p => <option key={p.name} value={p.name} />)}
            </datalist>
          </div>
          <div className="editor-equip-field editor-equip-field--damage">
            <label className="editor-field-label">Damage</label>
            <input
              type="text"
              className="editor-field-input"
              value={weaponDamage}
              onChange={(e) => setWeaponDamage(e.target.value)}
              placeholder="sw+1"
            />
          </div>
          <div className="editor-equip-field editor-equip-field--type">
            <label className="editor-field-label">Type</label>
            <select
              className="editor-field-input editor-field-select"
              value={weaponDamageType}
              onChange={(e) => setWeaponDamageType(e.target.value as DamageType)}
            >
              {GURPS_DAMAGE_TYPES.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="editor-equip-field editor-equip-field--reach">
            <label className="editor-field-label">Reach</label>
            <select
              className="editor-field-input editor-field-select"
              value={weaponReach}
              onChange={(e) => setWeaponReach(e.target.value as Reach)}
              disabled={weaponType === 'ranged'}
            >
              {(['C', '1', '2', '3', 'C,1', '1,2', '2,3'] as Reach[]).map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div className="editor-equip-field editor-equip-field--parry">
            <label className="editor-field-label">Parry</label>
            <input
              type="number"
              className="editor-field-input"
              value={weaponParry}
              onChange={(e) => setWeaponParry(parseInt(e.target.value) || 0)}
              disabled={weaponType === 'ranged'}
            />
          </div>
          <button
            className="editor-skill-add-btn"
            onClick={addWeapon}
            disabled={!weaponName.trim()}
            aria-label="Add weapon"
          >
            + Add
          </button>
        </div>
      </div>

      <div className="editor-section-group">
        <h3 className="editor-section-title">Weapons ({weapons.length})</h3>
        {weapons.length === 0 ? (
          <p className="editor-skills-empty">No weapons added yet. Use the form above to add weapons.</p>
        ) : (
          <div className="editor-skills-list">
            {weapons.map((w) => (
              <div key={w.id} className="editor-skill-row editor-equip-row">
                <span className="editor-skill-name">{w.name}</span>
                <span className="editor-equip-badge editor-equip-badge--damage">{w.damage ?? '—'}</span>
                <span className="editor-equip-badge editor-equip-badge--dmgtype">{w.damageType ?? '—'}</span>
                {w.type === 'melee' && (
                  <>
                    <span className="editor-equip-badge">R:{w.reach ?? '—'}</span>
                    <span className="editor-equip-badge">P:{w.parry ?? 0}</span>
                  </>
                )}
                {w.type === 'ranged' && (
                  <span className="editor-equip-badge editor-equip-badge--ranged">ranged</span>
                )}
                <button
                  className="editor-skill-remove-btn"
                  onClick={() => removeItem(w.id)}
                  aria-label={`Remove ${w.name}`}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="editor-section-group">
        <h3 className="editor-section-title">Armor</h3>
        <div className="editor-equip-armor-select">
          <label className="editor-field-label">Worn Armor</label>
          <select
            className="editor-field-input editor-field-select"
            value={armor?.name ?? ''}
            onChange={(e) => setArmor(e.target.value)}
          >
            <option value="">None</option>
            {GURPS_ARMOR_PRESETS.map(a => (
              <option key={a.name} value={a.name}>{a.name} (DR {a.dr})</option>
            ))}
          </select>
          {armor && (
            <div className="editor-equip-armor-stat">
              <span className="editor-equip-armor-dr">DR {armor.dr}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── PF2 Equipment Panel ─── */

type PF2WeaponPreset = {
  name: string
  damage: string
  damageType: PF2DamageType
  proficiencyCategory: 'simple' | 'martial' | 'advanced' | 'unarmed'
  traits: PF2WeaponTrait[]
  hands: 1 | 2
  group: string
}

const PF2_WEAPON_PRESETS: PF2WeaponPreset[] = [
  { name: 'Dagger', damage: '1d4', damageType: 'piercing', proficiencyCategory: 'simple', traits: ['agile', 'finesse', 'thrown'], hands: 1, group: 'Knife' },
  { name: 'Mace', damage: '1d6', damageType: 'bludgeoning', proficiencyCategory: 'simple', traits: ['shove'], hands: 1, group: 'Club' },
  { name: 'Spear', damage: '1d6', damageType: 'piercing', proficiencyCategory: 'simple', traits: ['thrown'], hands: 1, group: 'Spear' },
  { name: 'Morningstar', damage: '1d6', damageType: 'bludgeoning', proficiencyCategory: 'simple', traits: ['versatile'], hands: 1, group: 'Club' },
  { name: 'Staff', damage: '1d4', damageType: 'bludgeoning', proficiencyCategory: 'simple', traits: ['two_hand'], hands: 1, group: 'Club' },
  { name: 'Longsword', damage: '1d8', damageType: 'slashing', proficiencyCategory: 'martial', traits: ['versatile'], hands: 1, group: 'Sword' },
  { name: 'Shortsword', damage: '1d6', damageType: 'piercing', proficiencyCategory: 'martial', traits: ['agile', 'finesse'], hands: 1, group: 'Sword' },
  { name: 'Rapier', damage: '1d6', damageType: 'piercing', proficiencyCategory: 'martial', traits: ['deadly', 'disarm', 'finesse'], hands: 1, group: 'Sword' },
  { name: 'Scimitar', damage: '1d6', damageType: 'slashing', proficiencyCategory: 'martial', traits: ['forceful', 'sweep'], hands: 1, group: 'Sword' },
  { name: 'Warhammer', damage: '1d8', damageType: 'bludgeoning', proficiencyCategory: 'martial', traits: ['shove'], hands: 1, group: 'Hammer' },
  { name: 'Battleaxe', damage: '1d8', damageType: 'slashing', proficiencyCategory: 'martial', traits: ['sweep'], hands: 1, group: 'Axe' },
  { name: 'Greatsword', damage: '1d12', damageType: 'slashing', proficiencyCategory: 'martial', traits: ['versatile'], hands: 2, group: 'Sword' },
  { name: 'Greataxe', damage: '1d12', damageType: 'slashing', proficiencyCategory: 'martial', traits: ['sweep'], hands: 2, group: 'Axe' },
  { name: 'Glaive', damage: '1d8', damageType: 'slashing', proficiencyCategory: 'martial', traits: ['deadly', 'forceful', 'reach'], hands: 2, group: 'Polearm' },
  { name: 'Longbow', damage: '1d8', damageType: 'piercing', proficiencyCategory: 'martial', traits: ['deadly'], hands: 2, group: 'Bow' },
]

const PF2_ARMOR_PRESETS: { name: string; proficiencyCategory: PF2CharacterArmor['proficiencyCategory']; acBonus: number; dexCap: number | null }[] = [
  { name: 'Explorer\'s Clothing', proficiencyCategory: 'unarmored', acBonus: 0, dexCap: null },
  { name: 'Padded Armor', proficiencyCategory: 'light', acBonus: 1, dexCap: 3 },
  { name: 'Leather Armor', proficiencyCategory: 'light', acBonus: 1, dexCap: 4 },
  { name: 'Studded Leather', proficiencyCategory: 'light', acBonus: 2, dexCap: 3 },
  { name: 'Chain Shirt', proficiencyCategory: 'light', acBonus: 2, dexCap: 3 },
  { name: 'Scale Mail', proficiencyCategory: 'medium', acBonus: 3, dexCap: 2 },
  { name: 'Chain Mail', proficiencyCategory: 'medium', acBonus: 4, dexCap: 1 },
  { name: 'Breastplate', proficiencyCategory: 'medium', acBonus: 4, dexCap: 1 },
  { name: 'Half Plate', proficiencyCategory: 'heavy', acBonus: 5, dexCap: 1 },
  { name: 'Full Plate', proficiencyCategory: 'heavy', acBonus: 6, dexCap: 0 },
]

const PF2_ALL_WEAPON_TRAITS: PF2WeaponTrait[] = [
  'agile', 'backstabber', 'deadly', 'disarm', 'fatal', 'finesse', 'forceful',
  'free_hand', 'grapple', 'jousting', 'parry', 'reach', 'shove', 'sweep',
  'thrown', 'trip', 'twin', 'two_hand', 'unarmed', 'versatile',
]

const PF2_PROF_CATEGORIES = ['simple', 'martial', 'advanced', 'unarmed'] as const
const PF2_PHYSICAL_DAMAGE_TYPES: PF2DamageType[] = ['bludgeoning', 'piercing', 'slashing']

type PF2EquipmentPanelProps = {
  character: PF2CharacterSheet
  onUpdateWeapons: (weapons: PF2CharacterWeapon[]) => void
  onUpdateArmor: (armor: PF2CharacterArmor | null) => void
  onUpdateShield: (shieldBonus: number) => void
}

const PF2EquipmentPanel = ({ character, onUpdateWeapons, onUpdateArmor, onUpdateShield }: PF2EquipmentPanelProps) => {
  const [wpnName, setWpnName] = useState('')
  const [wpnDamage, setWpnDamage] = useState('')
  const [wpnDamageType, setWpnDamageType] = useState<PF2DamageType>('slashing')
  const [wpnProf, setWpnProf] = useState<PF2CharacterWeapon['proficiencyCategory']>('martial')
  const [wpnTraits, setWpnTraits] = useState<PF2WeaponTrait[]>([])
  const [, setWpnHands] = useState<1 | 2>(1)
  const [, setWpnGroup] = useState('Sword')

  const handleWeaponNameChange = useCallback((name: string) => {
    setWpnName(name)
    const preset = PF2_WEAPON_PRESETS.find(p => p.name.toLowerCase() === name.toLowerCase())
    if (preset) {
      setWpnDamage(preset.damage)
      setWpnDamageType(preset.damageType)
      setWpnProf(preset.proficiencyCategory)
      setWpnTraits(preset.traits)
      setWpnHands(preset.hands)
      setWpnGroup(preset.group)
    }
  }, [])

  const toggleTrait = useCallback((trait: PF2WeaponTrait) => {
    setWpnTraits(prev => prev.includes(trait) ? prev.filter(t => t !== trait) : [...prev, trait])
  }, [])

  const addWeapon = useCallback(() => {
    const name = wpnName.trim()
    if (!name) return
    const weapon: PF2CharacterWeapon = {
      id: generateUUID(),
      name,
      damage: wpnDamage || '1d6',
      damageType: wpnDamageType,
      proficiencyCategory: wpnProf,
      traits: wpnTraits,
      potencyRune: 0,
      strikingRune: null,
    }
    onUpdateWeapons([...character.weapons, weapon])
    setWpnName('')
    setWpnDamage('')
    setWpnDamageType('slashing')
    setWpnProf('martial')
    setWpnTraits([])
    setWpnHands(1)
    setWpnGroup('Sword')
  }, [wpnName, wpnDamage, wpnDamageType, wpnProf, wpnTraits, character.weapons, onUpdateWeapons])

  const removeWeapon = useCallback((weaponId: string) => {
    onUpdateWeapons(character.weapons.filter(w => w.id !== weaponId))
  }, [character.weapons, onUpdateWeapons])

  const selectArmor = useCallback((presetName: string) => {
    const preset = PF2_ARMOR_PRESETS.find(a => a.name === presetName)
    if (!preset) {
      onUpdateArmor(null)
      return
    }
    onUpdateArmor({
      id: generateUUID(),
      name: preset.name,
      proficiencyCategory: preset.proficiencyCategory,
      acBonus: preset.acBonus,
      dexCap: preset.dexCap,
      potencyRune: 0,
    })
  }, [onUpdateArmor])

  return (
    <div className="editor-equipment-section">
      <div className="editor-section-group">
        <h3 className="editor-section-title">Add Weapon</h3>
        <div className="editor-equip-add-form editor-equip-add-form--pf2">
          <div className="editor-equip-field editor-equip-field--name">
            <label className="editor-field-label">Weapon</label>
            <input
              type="text"
              className="editor-field-input"
              value={wpnName}
              onChange={(e) => handleWeaponNameChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addWeapon() }}
              placeholder="e.g. Longsword"
              list="pf2-weapons-list"
            />
            <datalist id="pf2-weapons-list">
              {PF2_WEAPON_PRESETS
                .filter(p => !character.weapons.some(w => w.name.toLowerCase() === p.name.toLowerCase()))
                .map(p => <option key={p.name} value={p.name} />)}
            </datalist>
          </div>
          <div className="editor-equip-field editor-equip-field--damage">
            <label className="editor-field-label">Damage</label>
            <input
              type="text"
              className="editor-field-input"
              value={wpnDamage}
              onChange={(e) => setWpnDamage(e.target.value)}
              placeholder="1d8"
            />
          </div>
          <div className="editor-equip-field editor-equip-field--type">
            <label className="editor-field-label">Dmg Type</label>
            <select
              className="editor-field-input editor-field-select"
              value={wpnDamageType}
              onChange={(e) => setWpnDamageType(e.target.value as PF2DamageType)}
            >
              {PF2_PHYSICAL_DAMAGE_TYPES.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="editor-equip-field editor-equip-field--prof">
            <label className="editor-field-label">Proficiency</label>
            <select
              className="editor-field-input editor-field-select"
              value={wpnProf}
              onChange={(e) => setWpnProf(e.target.value as PF2CharacterWeapon['proficiencyCategory'])}
            >
              {PF2_PROF_CATEGORIES.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div className="editor-equip-field editor-equip-field--traits">
            <label className="editor-field-label">Traits</label>
            <div className="editor-equip-traits-grid">
              {PF2_ALL_WEAPON_TRAITS.map(trait => (
                <label key={trait} className={`editor-equip-trait-chip ${wpnTraits.includes(trait) ? 'active' : ''}`}>
                  <input
                    type="checkbox"
                    checked={wpnTraits.includes(trait)}
                    onChange={() => toggleTrait(trait)}
                    className="editor-equip-trait-checkbox"
                  />
                  <span>{trait.replace('_', ' ')}</span>
                </label>
              ))}
            </div>
          </div>
          <button
            className="editor-skill-add-btn"
            onClick={addWeapon}
            disabled={!wpnName.trim()}
            aria-label="Add weapon"
          >
            + Add
          </button>
        </div>
      </div>

      <div className="editor-section-group">
        <h3 className="editor-section-title">Weapons ({character.weapons.length})</h3>
        {character.weapons.length === 0 ? (
          <p className="editor-skills-empty">No weapons added yet. Use the form above to add weapons.</p>
        ) : (
          <div className="editor-skills-list">
            {character.weapons.map((w) => (
              <div key={w.id} className="editor-skill-row editor-equip-row editor-equip-row--pf2">
                <span className="editor-skill-name">{w.name}</span>
                <span className="editor-equip-badge editor-equip-badge--damage">{w.damage}</span>
                <span className="editor-equip-badge editor-equip-badge--dmgtype">{w.damageType}</span>
                <span className="editor-equip-badge editor-equip-badge--prof">{w.proficiencyCategory}</span>
                {w.traits.length > 0 && (
                  <span className="editor-equip-traits-inline">
                    {w.traits.map(t => t.replace('_', ' ')).join(', ')}
                  </span>
                )}
                <button
                  className="editor-skill-remove-btn"
                  onClick={() => removeWeapon(w.id)}
                  aria-label={`Remove ${w.name}`}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="editor-section-group">
        <h3 className="editor-section-title">Armor</h3>
        <div className="editor-equip-armor-select">
          <label className="editor-field-label">Worn Armor</label>
          <select
            className="editor-field-input editor-field-select"
            value={character.armor?.name ?? ''}
            onChange={(e) => selectArmor(e.target.value)}
          >
            <option value="">None (Unarmored)</option>
            {PF2_ARMOR_PRESETS.map(a => (
              <option key={a.name} value={a.name}>
                {a.name} (+{a.acBonus} AC{a.dexCap !== null ? `, Dex cap +${a.dexCap}` : ''})
              </option>
            ))}
          </select>
          {character.armor && (
            <div className="editor-equip-armor-stats">
              <span className="editor-equip-badge editor-equip-badge--damage">+{character.armor.acBonus} AC</span>
              <span className="editor-equip-badge">{character.armor.proficiencyCategory}</span>
              {character.armor.dexCap !== null && (
                <span className="editor-equip-badge">Dex cap +{character.armor.dexCap}</span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="editor-section-group">
        <h3 className="editor-section-title">Shield</h3>
        <div className="editor-equip-armor-select">
          <label className="editor-field-label">Shield Bonus</label>
          <input
            type="number"
            className="editor-field-input"
            value={character.shieldBonus}
            onChange={(e) => onUpdateShield(parseInt(e.target.value) || 0)}
            min={0}
            max={5}
            style={{ width: 80 }}
          />
          <span className="editor-equip-shield-hint">
            {character.shieldBonus === 0 ? 'No shield' : `+${character.shieldBonus} AC when raised`}
          </span>
        </div>
      </div>
    </div>
  )
}

/* ─── GURPS Traits Panel ─── */

const GURPS_COMMON_ADVANTAGES = [
  'Combat Reflexes', 'High Pain Threshold', 'Acute Vision', 'Danger Sense', 'Luck',
  'Ambidexterity', 'Fearlessness', 'Hard to Kill', 'Night Vision', 'Rapid Healing',
  'Shield Wall Training', 'Weapon Bond', 'Enhanced Dodge', 'Fit', 'Tough Skin',
]

const GURPS_COMMON_DISADVANTAGES = [
  'Bad Temper', 'Overconfidence', 'Impulsiveness', 'Code of Honor', 'Phobia',
  'Bloodlust', 'Curious', 'Greed', 'Honesty', 'Sense of Duty',
  'Stubbornness', 'Compulsive Behavior', 'Berserk', 'Loner', 'Oblivious',
]

type GurpsTraitsPanelProps = {
  character: GurpsCharacterSheet
  onUpdateAdvantages: (advantages: Advantage[]) => void
  onUpdateDisadvantages: (disadvantages: Disadvantage[]) => void
}

const GurpsTraitsPanel = ({ character, onUpdateAdvantages, onUpdateDisadvantages }: GurpsTraitsPanelProps) => {
  const [newAdvName, setNewAdvName] = useState('')
  const [newAdvDesc, setNewAdvDesc] = useState('')
  const [newDisadvName, setNewDisadvName] = useState('')
  const [newDisadvDesc, setNewDisadvDesc] = useState('')

  const addAdvantage = useCallback(() => {
    const name = newAdvName.trim()
    if (!name) return
    if (character.advantages.some(a => a.name.toLowerCase() === name.toLowerCase())) return
    const advantage: Advantage = {
      id: generateUUID(),
      name,
      description: newAdvDesc.trim() || undefined,
    }
    onUpdateAdvantages([...character.advantages, advantage])
    setNewAdvName('')
    setNewAdvDesc('')
  }, [newAdvName, newAdvDesc, character.advantages, onUpdateAdvantages])

  const removeAdvantage = useCallback((advId: string) => {
    onUpdateAdvantages(character.advantages.filter(a => a.id !== advId))
  }, [character.advantages, onUpdateAdvantages])

  const addDisadvantage = useCallback(() => {
    const name = newDisadvName.trim()
    if (!name) return
    if (character.disadvantages.some(d => d.name.toLowerCase() === name.toLowerCase())) return
    const disadvantage: Disadvantage = {
      id: generateUUID(),
      name,
      description: newDisadvDesc.trim() || undefined,
    }
    onUpdateDisadvantages([...character.disadvantages, disadvantage])
    setNewDisadvName('')
    setNewDisadvDesc('')
  }, [newDisadvName, newDisadvDesc, character.disadvantages, onUpdateDisadvantages])

  const removeDisadvantage = useCallback((disadvId: string) => {
    onUpdateDisadvantages(character.disadvantages.filter(d => d.id !== disadvId))
  }, [character.disadvantages, onUpdateDisadvantages])

  return (
    <div className="editor-traits-section">
      {/* Advantages */}
      <div className="editor-section-group">
        <h3 className="editor-section-title">Add Advantage</h3>
        <div className="editor-skill-add-form editor-trait-add-form">
          <div className="editor-skill-add-field editor-skill-add-field--name">
            <label className="editor-field-label">Advantage Name</label>
            <input
              type="text"
              className="editor-field-input"
              value={newAdvName}
              onChange={(e) => setNewAdvName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addAdvantage() }}
              placeholder="e.g. Combat Reflexes"
              list="gurps-advantages-list"
            />
            <datalist id="gurps-advantages-list">
              {GURPS_COMMON_ADVANTAGES
                .filter(a => !character.advantages.some(existing => existing.name.toLowerCase() === a.toLowerCase()))
                .map(a => <option key={a} value={a} />)}
            </datalist>
          </div>
          <div className="editor-skill-add-field editor-trait-add-field--desc">
            <label className="editor-field-label">Description (optional)</label>
            <textarea
              className="editor-field-input editor-field-textarea"
              value={newAdvDesc}
              onChange={(e) => setNewAdvDesc(e.target.value)}
              placeholder="Brief description..."
              rows={2}
            />
          </div>
          <button
            className="editor-skill-add-btn"
            onClick={addAdvantage}
            disabled={!newAdvName.trim()}
            aria-label="Add advantage"
          >
            + Add
          </button>
        </div>
      </div>

      <div className="editor-section-group">
        <h3 className="editor-section-title">Advantages ({character.advantages.length})</h3>
        {character.advantages.length === 0 ? (
          <p className="editor-skills-empty">No advantages added yet. Use the form above to add advantages.</p>
        ) : (
          <div className="editor-skills-list">
            {character.advantages.map((adv) => (
              <div key={adv.id} className="editor-skill-row editor-trait-row">
                <div className="editor-trait-info">
                  <span className="editor-skill-name">{adv.name}</span>
                  {adv.description && (
                    <span className="editor-trait-description">{adv.description}</span>
                  )}
                </div>
                <button
                  className="editor-skill-remove-btn"
                  onClick={() => removeAdvantage(adv.id)}
                  aria-label={`Remove ${adv.name}`}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Disadvantages */}
      <div className="editor-section-group">
        <h3 className="editor-section-title">Add Disadvantage</h3>
        <div className="editor-skill-add-form editor-trait-add-form">
          <div className="editor-skill-add-field editor-skill-add-field--name">
            <label className="editor-field-label">Disadvantage Name</label>
            <input
              type="text"
              className="editor-field-input"
              value={newDisadvName}
              onChange={(e) => setNewDisadvName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addDisadvantage() }}
              placeholder="e.g. Bad Temper"
              list="gurps-disadvantages-list"
            />
            <datalist id="gurps-disadvantages-list">
              {GURPS_COMMON_DISADVANTAGES
                .filter(d => !character.disadvantages.some(existing => existing.name.toLowerCase() === d.toLowerCase()))
                .map(d => <option key={d} value={d} />)}
            </datalist>
          </div>
          <div className="editor-skill-add-field editor-trait-add-field--desc">
            <label className="editor-field-label">Description (optional)</label>
            <textarea
              className="editor-field-input editor-field-textarea"
              value={newDisadvDesc}
              onChange={(e) => setNewDisadvDesc(e.target.value)}
              placeholder="Brief description..."
              rows={2}
            />
          </div>
          <button
            className="editor-skill-add-btn"
            onClick={addDisadvantage}
            disabled={!newDisadvName.trim()}
            aria-label="Add disadvantage"
          >
            + Add
          </button>
        </div>
      </div>

      <div className="editor-section-group">
        <h3 className="editor-section-title">Disadvantages ({character.disadvantages.length})</h3>
        {character.disadvantages.length === 0 ? (
          <p className="editor-skills-empty">No disadvantages added yet. Use the form above to add disadvantages.</p>
        ) : (
          <div className="editor-skills-list">
            {character.disadvantages.map((disadv) => (
              <div key={disadv.id} className="editor-skill-row editor-trait-row">
                <div className="editor-trait-info">
                  <span className="editor-skill-name">{disadv.name}</span>
                  {disadv.description && (
                    <span className="editor-trait-description">{disadv.description}</span>
                  )}
                </div>
                <button
                  className="editor-skill-remove-btn"
                  onClick={() => removeDisadvantage(disadv.id)}
                  aria-label={`Remove ${disadv.name}`}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── PF2 Traits Panel ─── */

const PF2_COMMON_FEATS = [
  'Power Attack', 'Toughness', 'Shield Block', 'Sudden Charge', 'Point-Blank Shot',
  'Fleet', 'Incredible Initiative', 'Reactive Shield', 'Intimidating Strike', 'Cleave',
  'Natural Ambition', 'Ancestral Paragon', 'Assurance', 'Skill Training', 'Armor Proficiency',
]

const PF2_FEAT_TYPES = ['class', 'ancestry', 'general', 'skill'] as const

type PF2TraitsPanelProps = {
  character: PF2CharacterSheet
  onUpdateFeats: (feats: PF2Feat[]) => void
}

const PF2TraitsPanel = ({ character, onUpdateFeats }: PF2TraitsPanelProps) => {
  const [newFeatName, setNewFeatName] = useState('')
  const [newFeatType, setNewFeatType] = useState<string>('class')
  const [newFeatLevel, setNewFeatLevel] = useState(1)
  const [newFeatDesc, setNewFeatDesc] = useState('')

  const addFeat = useCallback(() => {
    const name = newFeatName.trim()
    if (!name) return
    if (character.feats.some(f => f.name.toLowerCase() === name.toLowerCase())) return
    const feat: PF2Feat = {
      id: generateUUID(),
      name,
      type: newFeatType,
      level: newFeatLevel,
      description: newFeatDesc.trim() || undefined,
    }
    onUpdateFeats([...character.feats, feat])
    setNewFeatName('')
    setNewFeatType('class')
    setNewFeatLevel(1)
    setNewFeatDesc('')
  }, [newFeatName, newFeatType, newFeatLevel, newFeatDesc, character.feats, onUpdateFeats])

  const removeFeat = useCallback((featId: string) => {
    onUpdateFeats(character.feats.filter(f => f.id !== featId))
  }, [character.feats, onUpdateFeats])

  return (
    <div className="editor-traits-section">
      <div className="editor-section-group">
        <h3 className="editor-section-title">Add Feat</h3>
        <div className="editor-skill-add-form editor-trait-add-form editor-trait-add-form--pf2">
          <div className="editor-skill-add-field editor-skill-add-field--name">
            <label className="editor-field-label">Feat Name</label>
            <input
              type="text"
              className="editor-field-input"
              value={newFeatName}
              onChange={(e) => setNewFeatName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addFeat() }}
              placeholder="e.g. Power Attack"
              list="pf2-feats-list"
            />
            <datalist id="pf2-feats-list">
              {PF2_COMMON_FEATS
                .filter(f => !character.feats.some(existing => existing.name.toLowerCase() === f.toLowerCase()))
                .map(f => <option key={f} value={f} />)}
            </datalist>
          </div>
          <div className="editor-skill-add-field editor-skill-add-field--ability">
            <label className="editor-field-label">Type</label>
            <select
              className="editor-field-input editor-field-select"
              value={newFeatType}
              onChange={(e) => setNewFeatType(e.target.value)}
            >
              {PF2_FEAT_TYPES.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="editor-skill-add-field editor-skill-add-field--level">
            <label className="editor-field-label">Level</label>
            <input
              type="number"
              className="editor-field-input"
              value={newFeatLevel}
              onChange={(e) => setNewFeatLevel(parseInt(e.target.value) || 1)}
              min={1}
              max={20}
            />
          </div>
          <div className="editor-skill-add-field editor-trait-add-field--desc">
            <label className="editor-field-label">Description (optional)</label>
            <textarea
              className="editor-field-input editor-field-textarea"
              value={newFeatDesc}
              onChange={(e) => setNewFeatDesc(e.target.value)}
              placeholder="Brief description..."
              rows={2}
            />
          </div>
          <button
            className="editor-skill-add-btn"
            onClick={addFeat}
            disabled={!newFeatName.trim()}
            aria-label="Add feat"
          >
            + Add
          </button>
        </div>
      </div>

      <div className="editor-section-group">
        <h3 className="editor-section-title">Feats ({character.feats.length})</h3>
        {character.feats.length === 0 ? (
          <p className="editor-skills-empty">No feats added yet. Use the form above to add feats.</p>
        ) : (
          <div className="editor-skills-list">
            {character.feats.map((feat) => (
              <div key={feat.id} className="editor-skill-row editor-trait-row editor-trait-row--pf2">
                <div className="editor-trait-info">
                  <span className="editor-skill-name">{feat.name}</span>
                  {feat.description && (
                    <span className="editor-trait-description">{feat.description}</span>
                  )}
                </div>
                <span className="editor-skill-ability-badge">{feat.type}</span>
                <span className="editor-equip-badge">Lv {feat.level}</span>
                <button
                  className="editor-skill-remove-btn"
                  onClick={() => removeFeat(feat.id)}
                  aria-label={`Remove ${feat.name}`}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
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
