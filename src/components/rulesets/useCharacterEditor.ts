import { useState } from 'react'
import type { CharacterSheet, RulesetId } from '../../../shared/types'
import { isPF2Character, isGurpsCharacter } from '../../../shared/types'
import type { Attributes, Skill, Equipment, Advantage, Disadvantage, DamageType } from '../../../shared/rulesets/gurps/types'
import type { PF2Skill, Proficiency, Abilities } from '../../../shared/rulesets/pf2/types'
import { calculateDerivedStats as gurpsCalculateDerivedStats, calculateTotalPoints } from '../../../shared/rulesets/gurps/rules'
import { calculateDerivedStats as pf2CalculateDerivedStats } from '../../../shared/rulesets/pf2/rules'
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
    if (!template) return
    
    if (rulesetId === 'pf2' && 'abilities' in template) {
      const pf2Template = template as Omit<import('../../../shared/rulesets/pf2/characterSheet').PF2CharacterSheet, 'id'>
      setCharacter({
        ...pf2Template,
        id: character.id,
        skills: pf2Template.skills.map(s => ({ ...s, id: uuid() })),
        weapons: pf2Template.weapons.map(w => ({ ...w, id: uuid() })),
        feats: pf2Template.feats.map(f => ({ ...f, id: uuid() })),
      } as CharacterSheet)
      setSelectedClass(templateKey)
    } else if (rulesetId === 'gurps' && 'attributes' in template) {
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

  const addSkill = () => {
    const name = window.prompt('Skill name')?.trim()
    if (!name) return
    
    if (isPF2Character(character)) {
      const abilityInput = window.prompt('Ability (str, dex, con, int, wis, cha)', 'int')?.trim().toLowerCase()
      const abilityMap: Record<string, keyof Abilities> = {
        str: 'strength', dex: 'dexterity', con: 'constitution',
        int: 'intelligence', wis: 'wisdom', cha: 'charisma'
      }
      const ability = abilityMap[abilityInput ?? 'int'] ?? 'intelligence'
      const profInput = window.prompt('Proficiency (untrained, trained, expert, master, legendary)', 'trained')?.trim().toLowerCase()
      const validProfs: Proficiency[] = ['untrained', 'trained', 'expert', 'master', 'legendary']
      const proficiency: Proficiency = validProfs.includes(profInput as Proficiency) ? (profInput as Proficiency) : 'trained'
      const newSkill: PF2Skill = { id: uuid(), name, ability, proficiency }
      setCharacter({ ...character, skills: [...character.skills, newSkill] })
    } else if (isGurpsCharacter(character)) {
      const levelStr = window.prompt('Skill level', '12')
      const level = Math.max(1, Math.min(20, Number(levelStr) || 12))
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

  const addEquipment = () => {
    if (!isGurpsCharacter(character)) return
    
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
    setCharacter({ ...character, equipment: [...character.equipment, newEquip] })
  }

  const removeEquipment = (equipId: string) => {
    if (!isGurpsCharacter(character)) return
    setCharacter({ ...character, equipment: character.equipment.filter((e: Equipment) => e.id !== equipId) })
  }

  const addAdvantage = () => {
    if (!isGurpsCharacter(character)) return
    
    const name = window.prompt('Advantage name')?.trim()
    if (!name) return
    const description = window.prompt('Description (optional)')?.trim()
    const newAdvantage: Advantage = { id: uuid(), name, description: description || undefined }
    setCharacter({ ...character, advantages: [...character.advantages, newAdvantage] })
  }

  const removeAdvantage = (id: string) => {
    if (!isGurpsCharacter(character)) return
    setCharacter({ ...character, advantages: character.advantages.filter((a: Advantage) => a.id !== id) })
  }

  const addDisadvantage = () => {
    if (!isGurpsCharacter(character)) return
    
    const name = window.prompt('Disadvantage name')?.trim()
    if (!name) return
    const description = window.prompt('Description (optional)')?.trim()
    const newDisadvantage: Disadvantage = { id: uuid(), name, description: description || undefined }
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
