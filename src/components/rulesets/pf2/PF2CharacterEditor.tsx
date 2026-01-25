import { Tooltip } from '../../ui/Tooltip'
import type { CharacterEditorProps } from '../types'
import { useCharacterEditor } from '../useCharacterEditor'
import type { PF2CharacterSheet } from '../../../../shared/rulesets/pf2/types'

export const PF2CharacterEditor = ({ character, setCharacter, onSave, onCancel }: CharacterEditorProps) => {
  const pf2Character = character as PF2CharacterSheet
  const {
    templateNames,
    selectedClass,
    loadTemplate,
    updateAttribute,
    addSkill,
    removeSkill,
    addEquipment,
    removeEquipment,
    addAdvantage,
    removeAdvantage,
  } = useCharacterEditor({ character, setCharacter, rulesetId: 'pf2' })

  return (
    <div className="modal-overlay">
      <div className="modal-content character-modal">
        <div className="modal-header">
          <h2>Character Builder</h2>
          <div className="pf2-header-info">
            <span className="pf2-class">{selectedClass.charAt(0).toUpperCase() + selectedClass.slice(1)}</span>
            <span className="pf2-level">Lv. 1</span>
          </div>
        </div>
        
        <div className="char-section">
          <label className="char-label">Class</label>
          <div className="template-buttons">
            {templateNames.map(key => (
              <button 
                key={key} 
                className={`template-btn pf2-class-btn ${selectedClass === key ? 'active' : ''}`}
                onClick={() => loadTemplate(key)}
              >
                {key.charAt(0).toUpperCase() + key.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="char-section">
          <label className="char-label">Character Name</label>
          <input
            type="text"
            className="char-input"
            value={pf2Character.name}
            onChange={(e) => setCharacter({ ...pf2Character, name: e.target.value })}
          />
        </div>

        <div className="char-section">
          <label className="char-label">Abilities</label>
          <div className="attr-grid pf2-attr-grid">
            {([
              { key: 'strength', label: 'STR' },
              { key: 'dexterity', label: 'DEX' },
              { key: 'constitution', label: 'CON' },
              { key: 'intelligence', label: 'INT' },
              { key: 'wisdom', label: 'WIS' },
              { key: 'charisma', label: 'CHA' },
            ] as const).map(({ key, label }) => (
              <div key={key} className="attr-row">
                <span className="attr-name">{label}</span>
                <button className="attr-btn" onClick={() => updateAttribute(key, -1)}>-</button>
                <span className="attr-value">{pf2Character.abilities[key] ?? 10}</span>
                <button className="attr-btn" onClick={() => updateAttribute(key, 1)}>+</button>
              </div>
            ))}
          </div>
        </div>

        <div className="char-section">
          <label className="char-label">Combat Stats</label>
          <div className="derived-grid pf2-derived-grid">
            <div className="derived-item pf2-stat">
              <span className="stat-label">HP</span>
              <span className="stat-value">{pf2Character.derived.hitPoints}</span>
            </div>
            <div className="derived-item pf2-stat">
              <span className="stat-label">AC</span>
              <span className="stat-value">{pf2Character.derived.armorClass}</span>
            </div>
            <div className="derived-item pf2-stat">
              <span className="stat-label">Speed</span>
              <span className="stat-value">{pf2Character.derived.speed / 5} hexes</span>
            </div>
          </div>
        </div>

        <div className="char-section">
          <label className="char-label">
            Feats
            <button className="add-btn" onClick={addAdvantage}>+ Add</button>
          </label>
          <div className="list-items">
            {pf2Character.feats.length === 0 ? (
              <div className="empty-list">No feats added</div>
            ) : (
              pf2Character.feats.map((feat) => (
                <div key={feat.id} className="list-item">
                  <span>{feat.name}{feat.description ? ` (${feat.description})` : ''}</span>
                  <button className="remove-btn" onClick={() => removeAdvantage(feat.id)}>x</button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="char-section">
          <label className="char-label">
            Skills
            <button className="add-btn" onClick={addSkill}>+ Add</button>
          </label>
          <div className="list-items">
            {pf2Character.skills.length === 0 ? (
              <div className="empty-list">No skills added</div>
            ) : (
              pf2Character.skills.map((skill) => (
                <div key={skill.id} className="list-item">
                  <Tooltip content="Skill bonus added to d20 rolls." position="right">
                    <span>{skill.name} (+{skill.proficiency})</span>
                  </Tooltip>
                  <button className="remove-btn" onClick={() => removeSkill(skill.id)}>x</button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="char-section">
          <label className="char-label">
            Weapons
            <button className="add-btn" onClick={addEquipment}>+ Add</button>
          </label>
          <div className="list-items">
            {pf2Character.weapons.length === 0 ? (
              <div className="empty-list">No weapons added</div>
            ) : (
              pf2Character.weapons.map((equip) => (
                <div key={equip.id} className="list-item">
                  <Tooltip content={`Damage: ${equip.damage}`} position="right">
                    <span>{equip.name} ({equip.damage})</span>
                  </Tooltip>
                  <button className="remove-btn" onClick={() => removeEquipment(equip.id)}>x</button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="modal-actions">
          <button onClick={onCancel}>Cancel</button>
          <button className="primary" onClick={onSave}>Save Character</button>
        </div>
      </div>
    </div>
  )
}
