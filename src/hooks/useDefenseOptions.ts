import { useState, useMemo, useEffect } from 'react'
import type { GurpsCombatantState, PendingDefense } from '../../shared/rulesets/gurps/types'
import type { GurpsCharacterSheet } from '../../shared/rulesets/gurps/characterSheet'
import { getDefenseOptions, calculateDefenseValue, getPostureModifiers } from '../../shared/rulesets/gurps/rules'

type ActiveDefenseType = 'dodge' | 'parry' | 'block'

export type ComputedDefenseOptions = {
  dodge: number
  parry: { value: number; weapon: string } | null
  block: { value: number; shield: string } | null
  canRetreat: boolean
  baseDodge: number
  baseParry: { value: number; weapon: string } | null
  baseBlock: { value: number; shield: string } | null
}

export function useDefenseOptions(
  character: GurpsCharacterSheet | null,
  combatant: GurpsCombatantState | null,
  pendingDefense: PendingDefense | null
) {
  const [retreat, setRetreat] = useState(false)
  const [dodgeAndDrop, setDodgeAndDrop] = useState(false)

  // Reset when pending defense changes (new attack incoming or resolved)
  useEffect(() => {
    if (!pendingDefense) {
      queueMicrotask(() => {
        setRetreat(false)
        setDodgeAndDrop(false)
      })
    }
  }, [pendingDefense])

  const options = useMemo<ComputedDefenseOptions | null>(() => {
    if (!character || !combatant || !pendingDefense) return null

    const derivedDodge = character.derived.dodge
    const baseOpts = getDefenseOptions(character, derivedDodge)
    const postureMods = getPostureModifiers(combatant.posture)
    const inCloseCombat = !!combatant.inCloseCombatWith

    const getFinalValue = (type: ActiveDefenseType, base: number, weaponName?: string) => {
      const sameWeaponParry = type === 'parry' && weaponName
        ? (combatant.parryWeaponsUsedThisTurn ?? []).includes(weaponName)
        : false

      return calculateDefenseValue(base, {
        retreat,
        dodgeAndDrop: type === 'dodge' ? dodgeAndDrop : false,
        inCloseCombat,
        defensesThisTurn: combatant.defensesThisTurn,
        deceptivePenalty: pendingDefense.deceptivePenalty,
        postureModifier: postureMods.defenseVsMelee,
        defenseType: type,
        sameWeaponParry,
      })
    }

    return {
      dodge: getFinalValue('dodge', baseOpts.dodge),
      parry: baseOpts.parry
        ? { value: getFinalValue('parry', baseOpts.parry.value, baseOpts.parry.weapon), weapon: baseOpts.parry.weapon }
        : null,
      block: baseOpts.block
        ? { value: getFinalValue('block', baseOpts.block.value), shield: baseOpts.block.shield }
        : null,
      canRetreat: !combatant.retreatedThisTurn,
      baseDodge: baseOpts.dodge,
      baseParry: baseOpts.parry ? { value: baseOpts.parry.value, weapon: baseOpts.parry.weapon } : null,
      baseBlock: baseOpts.block ? { value: baseOpts.block.value, shield: baseOpts.block.shield } : null,
    }
  }, [character, combatant, pendingDefense, retreat, dodgeAndDrop])

  return {
    options,
    retreat,
    setRetreat,
    dodgeAndDrop,
    setDodgeAndDrop,
  }
}
