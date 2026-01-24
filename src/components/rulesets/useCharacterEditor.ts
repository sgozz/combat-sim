import { useState } from 'react'
import type { CharacterSheet, Attributes, Skill, Equipment, Advantage, Disadvantage, DamageType, RulesetId } from '../../../shared/types'
import { calculateDerivedStats, calculateTotalPoints } from '../../../shared/rules'
import { getTemplatesForRuleset, TEMPLATE_NAMES, PF2_TEMPLATE_NAMES } from '../../data/characterTemplates'
import { uuid } from '../../utils/uuid'

export type UseCharacterEditorProps = {
  character: CharacterSheet
  setCharacter: (character: CharacterSheet) => void
  rulesetId: RulesetId
}

export const useCharacterEditor = ({ character, setCharacter, rulesetId }: UseCharacterEditorProps) => {
  const templates = getTemplatesForRuleset(rulesetId)
  const templateNames = rulesetId === 'pf2' ? PF2_TEMPLATE_NAMES : TEMPLATE_NAMES
  const [selectedClass, setSelectedClass] = useState<string>('fighter')
  
  const loadTemplate = (templateKey: string) => {
    const template = templates[templateKey]
    if (template) {
      setCharacter({
        ...template,
        id: character.id,
        skills: template.skills.map(s => ({ ...s, id: uuid() })),
        equipment: template.equipment.map(e => ({ ...e, id: uuid() })),
        advantages: template.advantages.map(a => ({ ...a, id: uuid() })),
        disadvantages: template.disadvantages.map(d => ({ ...d, id: uuid() })),
      })
      if (rulesetId === 'pf2') {
        setSelectedClass(templateKey)
      }
    }
  }

  const updateAttribute = (attr: keyof Attributes, delta: number) => {
    const current = character.attributes[attr] ?? 10
    const newValue = Math.max(7, Math.min(20, current + delta))
    setCharacter({
      ...character,
      attributes: { ...character.attributes, [attr]: newValue },
      derived: calculateDerivedStats({ ...character.attributes, [attr]: newValue }),
    })
  }

  const addSkill = () => {
    const name = window.prompt('Skill name')?.trim()
    if (!name) return
    const levelStr = window.prompt('Skill level', '12')
    const level = Math.max(1, Math.min(20, Number(levelStr) || 12))
    const newSkill: Skill = { id: uuid(), name, level }
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
    const name = window.prompt('Weapon name')?.trim()
    if (!name) return
    const damage = window.prompt('Damage formula (e.g., 1d8, 2d6)', '1d6')?.trim() || '1d6'
    const typeInput = window.prompt('Damage type (crushing, cutting, impaling, piercing)', 'crushing')?.trim().toLowerCase()
    const validTypes: DamageType[] = ['crushing', 'cutting', 'impaling', 'piercing']
    const damageType: DamageType = validTypes.includes(typeInput as DamageType) ? (typeInput as DamageType) : 'crushing'
    const newEquip: Equipment = { 
      id: uuid(), 
      name, 
      type: 'melee',
      damage,
      damageType,
      reach: '1',
      parry: 0,
    }
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

  const addAdvantage = () => {
    const label = rulesetId === 'pf2' ? 'Feat' : 'Advantage'
    const name = window.prompt(`${label} name`)?.trim()
    if (!name) return
    const description = window.prompt('Description (optional)')?.trim()
    const newAdvantage: Advantage = { id: uuid(), name, description: description || undefined }
    setCharacter({
      ...character,
      advantages: [...character.advantages, newAdvantage],
    })
  }

  const removeAdvantage = (id: string) => {
    setCharacter({
      ...character,
      advantages: character.advantages.filter(a => a.id !== id),
    })
  }

  const addDisadvantage = () => {
    const name = window.prompt('Disadvantage name')?.trim()
    if (!name) return
    const description = window.prompt('Description (optional)')?.trim()
    const newDisadvantage: Disadvantage = { id: uuid(), name, description: description || undefined }
    setCharacter({
      ...character,
      disadvantages: [...character.disadvantages, newDisadvantage],
    })
  }

  const removeDisadvantage = (id: string) => {
    setCharacter({
      ...character,
      disadvantages: character.disadvantages.filter(d => d.id !== id),
    })
  }

  const totalPoints = calculateTotalPoints(character)

  return {
    templates,
    templateNames,
    selectedClass,
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
  }
}
