import { useState } from 'react'
import type { CharacterSheet, RulesetId } from '../../../shared/types'
import { isPF2Character, isGurpsCharacter } from '../../../shared/types'
import type { Attributes, Skill, Equipment, Advantage, Disadvantage, DamageType } from '../../../shared/rulesets/gurps/types'
import type { PF2Skill, Proficiency, Abilities } from '../../../shared/rulesets/pf2/types'
import { calculateDerivedStats as gurpsCalculateDerivedStats, calculateTotalPoints } from '../../../shared/rulesets/gurps/rules'
import { calculateDerivedStats as pf2CalculateDerivedStats } from '../../../shared/rulesets/pf2/rules'
import { getTemplatesForRuleset } from '../../data/characterTemplates'
import { rulesets } from '../../../shared/rulesets'
import { generateUUID as uuid } from '../../utils/uuid'

export type UseCharacterEditorProps = {
  character: CharacterSheet
  setCharacter: (character: CharacterSheet) => void
  rulesetId: RulesetId
}

export const useCharacterEditor = ({ character, setCharacter, rulesetId }: UseCharacterEditorProps) => {
  const templates = getTemplatesForRuleset(rulesetId)
  const templateNames = rulesets[rulesetId].ui.getTemplateNames()
  const [selectedClass, setSelectedClass] = useState<string>('fighter')
  
  const loadTemplate = (templateKey: string) => {
    const template = templates[templateKey]
    if (!template) return
    
    if ('abilities' in template) {
      const pf2Template = template as Omit<import('../../../shared/rulesets/pf2/characterSheet').PF2CharacterSheet, 'id'>
      setCharacter({
        ...pf2Template,
        id: character.id,
        skills: pf2Template.skills.map(s => ({ ...s, id: uuid() })),
        weapons: pf2Template.weapons.map(w => ({ ...w, id: uuid() })),
        feats: pf2Template.feats.map(f => ({ ...f, id: uuid() })),
      } as CharacterSheet)
      setSelectedClass(templateKey)
    } else if ('attributes' in template) {
      const gurpsTemplate = template as Omit<import('../../../shared/rulesets/gurps/characterSheet').GurpsCharacterSheet, 'id'>
      setCharacter({
        ...gurpsTemplate,
        id: character.id,
        skills: gurpsTemplate.skills.map(s => ({ ...s, id: uuid() })),
        equipment: gurpsTemplate.equipment.map(e => ({ ...e, id: uuid() })),
        advantages: gurpsTemplate.advantages.map(a => ({ ...a, id: uuid() })),
        disadvantages: gurpsTemplate.disadvantages.map(d => ({ ...d, id: uuid() })),
      } as CharacterSheet)
    }
  }

  const updateAttribute = (attr: string, delta: number) => {
    if (isPF2Character(character)) {
      // PF2 branch - uses abilities
      const abilityKey = attr as keyof Abilities
      const currentValue = character.abilities[abilityKey] ?? 10
      const newValue = Math.max(1, Math.min(30, currentValue + delta))
      const newAbilities = { ...character.abilities, [abilityKey]: newValue }
      
      // Recalculate derived stats with all required PF2 inputs
      const newDerived = pf2CalculateDerivedStats(
        newAbilities,
        character.level,
        character.classHP,
        character.armor?.acBonus ?? 0,
        character.armor?.dexCap ?? null,
        character.saveProficiencies,
        character.perceptionProficiency,
        character.armorProficiency
      )
      
      setCharacter({ ...character, abilities: newAbilities, derived: newDerived })
    } else if (isGurpsCharacter(character)) {
      // GURPS branch - uses attributes
      const attrKey = attr as keyof Attributes
      const current = character.attributes[attrKey] ?? 10
      const newValue = Math.max(7, Math.min(20, current + delta))
      const newAttributes = { ...character.attributes, [attrKey]: newValue }
      const newDerived = gurpsCalculateDerivedStats(newAttributes)
      setCharacter({ ...character, attributes: newAttributes, derived: newDerived })
    }
  }

  const addSkill = (params?: { name: string; level?: number; ability?: keyof Abilities; proficiency?: Proficiency }) => {
    if (!params) return
    const name = params.name.trim()
    if (!name) return
    
    if (isPF2Character(character)) {
      const ability = params.ability ?? 'intelligence'
      const proficiency: Proficiency = params.proficiency ?? 'trained'
      const newSkill: PF2Skill = { id: uuid(), name, ability, proficiency }
      setCharacter({ ...character, skills: [...character.skills, newSkill] })
    } else if (isGurpsCharacter(character)) {
      const level = Math.max(1, Math.min(20, params.level ?? 12))
      const newSkill: Skill = { id: uuid(), name, level }
      setCharacter({ ...character, skills: [...character.skills, newSkill] })
    }
  }

  const removeSkill = (skillId: string) => {
    if (isPF2Character(character)) {
      setCharacter({ ...character, skills: character.skills.filter(s => s.id !== skillId) })
    } else if (isGurpsCharacter(character)) {
      setCharacter({ ...character, skills: character.skills.filter(s => s.id !== skillId) })
    }
  }

  const addEquipment = (params?: { name: string; damage?: string; damageType?: DamageType }) => {
    if (!isGurpsCharacter(character)) return
    if (!params) return
    const name = params.name.trim()
    if (!name) return
    const damage = params.damage ?? '1d6'
    const damageType: DamageType = params.damageType ?? 'crushing'
    const newEquip: Equipment = { 
      id: uuid(), 
      name, 
      type: 'melee',
      damage,
      damageType,
      reach: '1',
      parry: 0,
    }
    setCharacter({ ...character, equipment: [...character.equipment, newEquip] })
  }

  const removeEquipment = (equipId: string) => {
    if (!isGurpsCharacter(character)) return
    setCharacter({ ...character, equipment: character.equipment.filter((e: Equipment) => e.id !== equipId) })
  }

  const addAdvantage = (params?: { name: string; description?: string }) => {
    if (!isGurpsCharacter(character)) return
    if (!params) return
    const name = params.name.trim()
    if (!name) return
    const newAdvantage: Advantage = { id: uuid(), name, description: params.description?.trim() || undefined }
    setCharacter({ ...character, advantages: [...character.advantages, newAdvantage] })
  }

  const removeAdvantage = (id: string) => {
    if (!isGurpsCharacter(character)) return
    setCharacter({ ...character, advantages: character.advantages.filter((a: Advantage) => a.id !== id) })
  }

  const addDisadvantage = (params?: { name: string; description?: string }) => {
    if (!isGurpsCharacter(character)) return
    if (!params) return
    const name = params.name.trim()
    if (!name) return
    const newDisadvantage: Disadvantage = { id: uuid(), name, description: params.description?.trim() || undefined }
    setCharacter({ ...character, disadvantages: [...character.disadvantages, newDisadvantage] })
  }

  const removeDisadvantage = (id: string) => {
    if (!isGurpsCharacter(character)) return
    setCharacter({ ...character, disadvantages: character.disadvantages.filter((d: Disadvantage) => d.id !== id) })
  }

  const totalPoints = isGurpsCharacter(character) ? calculateTotalPoints(character) : 0

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
