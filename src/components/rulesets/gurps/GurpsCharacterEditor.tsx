import { Tooltip } from '../../ui/Tooltip'
import type { CharacterEditorProps } from '../types'
import { useCharacterEditor } from '../useCharacterEditor'

export const GurpsCharacterEditor = ({ character, setCharacter, onSave, onCancel }: CharacterEditorProps) => {
  const {
    templates,
    templateNames,
    totalPoints,
    loadTemplate,
    updateAttribute,
    addSkill,
    removeSkill,
    addEquipment,
    removeEquipment,
    addAdvantage,
    removeAdvantage,
    addDisadvantage,
    removeDisadvantage,
  } = useCharacterEditor({ character, setCharacter, rulesetId: 'gurps' })

  return (
    <div className="modal-overlay">
      <div className="modal-content character-modal">
        <div className="modal-header">
          <h2>Character Builder</h2>
          <div className="point-total">
            <span className="point-label">Total Points:</span>
            <span className={`point-value ${totalPoints > 150 ? 'over-budget' : ''}`}>{totalPoints}</span>
          </div>
        </div>
        
        <div className="char-section">
          <label className="char-label">Load Template</label>
          <div className="template-buttons">
            {templateNames.map(key => (
              <button 
                key={key} 
                className="template-btn"
                onClick={() => loadTemplate(key)}
              >
                {templates[key].name}
              </button>
            ))}
          </div>
        </div>

        <div className="char-section">
          <label className="char-label">Name</label>
          <input
            type="text"
            className="char-input"
            value={character.name}
            onChange={(e) => setCharacter({ ...character, name: e.target.value })}
          />
        </div>

        <div className="char-section">
          <label className="char-label">Attributes</label>
          <div className="attr-grid">
            {(['strength', 'dexterity', 'intelligence', 'health'] as const).map((attr) => (
              <div key={attr} className="attr-row">
                <span className="attr-name">{attr.slice(0, 2).toUpperCase()}</span>
                <button className="attr-btn" onClick={() => updateAttribute(attr, -1)}>-</button>
                <span className="attr-value">{character.attributes[attr]}</span>
                <button className="attr-btn" onClick={() => updateAttribute(attr, 1)}>+</button>
              </div>
            ))}
          </div>
        </div>

        <div className="char-section">
          <label className="char-label">Derived Stats</label>
          <div className="derived-grid">
            <div className="derived-item">HP: {character.derived.hitPoints}</div>
            <div className="derived-item">FP: {character.derived.fatiguePoints}</div>
            <div className="derived-item">Speed: {character.derived.basicSpeed}</div>
            <div className="derived-item">Move: {character.derived.basicMove}</div>
            <div className="derived-item">Dodge: {character.derived.dodge}</div>
          </div>
        </div>

        <div className="char-section">
          <label className="char-label">
            Advantages
            <button className="add-btn" onClick={addAdvantage}>+ Add</button>
          </label>
          <div className="list-items">
            {character.advantages.length === 0 ? (
              <div className="empty-list">No advantages added</div>
            ) : (
              character.advantages.map((adv) => (
                <div key={adv.id} className="list-item">
                  <span>{adv.name}{adv.description ? ` (${adv.description})` : ''}</span>
                  <button className="remove-btn" onClick={() => removeAdvantage(adv.id)}>x</button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="char-section">
          <label className="char-label">
            Disadvantages
            <button className="add-btn" onClick={addDisadvantage}>+ Add</button>
          </label>
          <div className="list-items">
            {character.disadvantages.length === 0 ? (
              <div className="empty-list">No disadvantages added</div>
            ) : (
              character.disadvantages.map((dis) => (
                <div key={dis.id} className="list-item">
                  <span>{dis.name}{dis.description ? ` (${dis.description})` : ''}</span>
                  <button className="remove-btn" onClick={() => removeDisadvantage(dis.id)}>x</button>
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
            {character.skills.length === 0 ? (
              <div className="empty-list">No skills added</div>
            ) : (
              character.skills.map((skill) => (
                <div key={skill.id} className="list-item">
                  <Tooltip content="Skill Level determines your base chance to succeed (roll 3d6 ≤ skill)." position="right">
                    <span>{skill.name} ({skill.level})</span>
                  </Tooltip>
                  <button className="remove-btn" onClick={() => removeSkill(skill.id)}>x</button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="char-section">
          <label className="char-label">
            Equipment
            <button className="add-btn" onClick={addEquipment}>+ Add</button>
          </label>
          <div className="list-items">
            {character.equipment.length === 0 ? (
              <div className="empty-list">No equipment added</div>
            ) : (
              character.equipment.map((equip) => (
                <div key={equip.id} className="list-item">
                  <Tooltip 
                    content={`Reach: ${equip.reach ?? 1}, Parry: ${equip.parry ?? 0}${equip.block ? `, Block: ${equip.block}` : ''}`} 
                    position="right"
                  >
                    <span>{equip.name} ({equip.damage} {equip.damageType ?? 'cr'})</span>
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
