import type { CharacterSheet, Attributes, Skill, Equipment } from '../../../shared/types'
import { calculateDerivedStats } from '../../../shared/rules'

type CharacterEditorProps = {
  character: CharacterSheet
  setCharacter: (character: CharacterSheet) => void
  onSave: () => void
  onCancel: () => void
}

export const CharacterEditor = ({ character, setCharacter, onSave, onCancel }: CharacterEditorProps) => {
  const updateAttribute = (attr: keyof Attributes, delta: number) => {
    const current = character.attributes[attr]
    const newValue = Math.max(7, Math.min(20, current + delta))
    setCharacter({
      ...character,
      attributes: { ...character.attributes, [attr]: newValue },
      derived: calculateDerivedStats({ ...character.attributes, [attr]: newValue }),
    })
  }

  const addSkill = () => {
    const name = window.prompt('Skill name (e.g., Brawling, Sword)')?.trim()
    if (!name) return
    const levelStr = window.prompt('Skill level (10-18)', '12')
    const level = Math.max(10, Math.min(18, Number(levelStr) || 12))
    const newSkill: Skill = { id: crypto.randomUUID(), name, level }
    setCharacter({
      ...character,
      skills: [...character.skills, newSkill],
    })
  }

  const removeSkill = (skillId: string) => {
    setCharacter({
      ...character,
      skills: character.skills.filter(s => s.id !== skillId),
    })
  }

  const addEquipment = () => {
    const name = window.prompt('Weapon name (e.g., Sword, Club)')?.trim()
    if (!name) return
    const damage = window.prompt('Damage formula (e.g., 1d+2, 2d)', '1d+1')?.trim() || '1d'
    const newEquip: Equipment = { id: crypto.randomUUID(), name, damage }
    setCharacter({
      ...character,
      equipment: [...character.equipment, newEquip],
    })
  }

  const removeEquipment = (equipId: string) => {
    setCharacter({
      ...character,
      equipment: character.equipment.filter(e => e.id !== equipId),
    })
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content character-modal">
        <h2>Character Builder</h2>
        
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
            Skills
            <button className="add-btn" onClick={addSkill}>+ Add</button>
          </label>
          <div className="list-items">
            {character.skills.length === 0 ? (
              <div className="empty-list">No skills added</div>
            ) : (
              character.skills.map((skill) => (
                <div key={skill.id} className="list-item">
                  <span>{skill.name} ({skill.level})</span>
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
                  <span>{equip.name} ({equip.damage})</span>
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
