import { useMemo, useState, useEffect } from 'react'
import type {
  MatchState,
  ManeuverType,
  CombatActionPayload,
  HitLocation,
  DefenseType,
  DefenseChoice,
  AOAVariant,
  AODVariant,
  WaitTrigger,
  ReadyAction,
  EquipmentSlot
} from '../../../../shared/types'
import {
  getDefenseOptions,
  calculateDefenseValue,
  getPostureModifiers,
  calculateEncumbrance,
  getRangePenalty,
  getHitLocationPenalty
} from '../../../../shared/rules'
import { hexDistance } from '../../../utils/hex'
import type { RulesetUIAdapter } from '../../../../shared/rulesets/Ruleset'
import { rulesets } from '../../../../shared/rulesets'

export type ManeuverDef = {
  type: ManeuverType
  label: string
  shortLabel: string
  icon: string
  desc: string
  key: string
}

export type AOAVariantDef = {
  variant: AOAVariant
  label: string
  desc: string
}

export type AODVariantDef = {
  variant: AODVariant
  label: string
  desc: string
}

export type GamePhase = 
  | 'lobby_setup'
  | 'loading'
  | 'finished'
  | 'defending'
  | 'select_maneuver'
  | 'in_turn'
  | 'waiting_opponent'

export type DefenseValues = {
  dodge: number
  parry: number | null
  block: number | null
  canRetreat: boolean
}

export type HitChanceInfo = {
  dist: number
  baseSkillLevel: number
  skillName: string
  rangeMod: number
  hitLocMod: number
  shockMod: number
  deceptiveMod: number
  rapidStrikeMod: number
  effectiveSkill: number
  prob: number
  color: string
}

export type GameActionsContext = {
  matchState: MatchState | null
  playerId: string | null
  selectedTargetId: string | null
  isMyTurn: boolean
  lobbyPlayerCount: number
  isCreator: boolean
  matchCode: string | null
  inLobbyButNoMatch: boolean
  uiAdapter?: RulesetUIAdapter
}

export type AttackOptions = {
  hitLocation: HitLocation
  setHitLocation: (loc: HitLocation) => void
  deceptiveLevel: 0 | 1 | 2
  setDeceptiveLevel: (level: 0 | 1 | 2) => void
  rapidStrike: boolean
  setRapidStrike: (v: boolean) => void
}

export type DefenseModifiers = {
  retreat: boolean
  setRetreat: (v: boolean) => void
  dodgeAndDrop: boolean
  setDodgeAndDrop: (v: boolean) => void
}

export const getRulesetUiAdapter = (rulesetId?: MatchState['rulesetId']): RulesetUIAdapter => {
  const selected = rulesetId ? rulesets[rulesetId] : rulesets.gurps
  return (selected?.ui ?? rulesets.gurps.ui)
}

const PROBABILITY_TABLE: Record<number, number> = {
  3: 0.5, 4: 1.9, 5: 4.6, 6: 9.3, 7: 16.2, 8: 25.9, 9: 37.5,
  10: 50.0, 11: 62.5, 12: 74.1, 13: 83.8, 14: 90.7, 15: 95.4, 16: 98.1
}

export const getHitProbability = (skill: number): number => {
  if (skill <= 3) return 0.5
  if (skill >= 17) return 99
  return PROBABILITY_TABLE[skill] ?? 50
}

export const getSuccessChance = (target: number): number => {
  if (target < 3) return 0
  if (target >= 16) return 98.1
  return PROBABILITY_TABLE[target] || 0
}

export const useGameActions = (ctx: GameActionsContext) => {
  const { matchState, playerId, selectedTargetId, isMyTurn, lobbyPlayerCount, isCreator, matchCode, inLobbyButNoMatch, uiAdapter } = ctx

  const [hitLocation, setHitLocation] = useState<HitLocation>('torso')
  const [deceptiveLevel, setDeceptiveLevel] = useState<0 | 1 | 2>(0)
  const [rapidStrike, setRapidStrike] = useState(false)
  const [retreat, setRetreat] = useState(false)
  const [dodgeAndDrop, setDodgeAndDrop] = useState(false)
  const [botCount, setBotCount] = useState(1)

  const pendingDefense = matchState?.pendingDefense
  useEffect(() => {
    if (!pendingDefense) {
      queueMicrotask(() => {
        setRetreat(false)
        setDodgeAndDrop(false)
      })
    }
  }, [pendingDefense])

  const playerCombatant = useMemo(() => {
    if (!playerId || !matchState) return null
    return matchState.combatants.find(c => c.playerId === playerId) ?? null
  }, [playerId, matchState])

  const playerCharacter = useMemo(() => {
    if (!playerCombatant || !matchState) return null
    return matchState.characters.find(c => c.id === playerCombatant.characterId) ?? null
  }, [playerCombatant, matchState])

  const activeCombatant = useMemo(() => {
    if (!matchState) return null
    return matchState.combatants.find(c => c.playerId === matchState.activeTurnPlayerId) ?? null
  }, [matchState])

  const activeCharacter = useMemo(() => {
    if (!activeCombatant || !matchState) return null
    return matchState.characters.find(c => c.id === activeCombatant.characterId) ?? null
  }, [activeCombatant, matchState])

  const currentManeuver = playerCombatant?.maneuver ?? null

  const encumbrance = useMemo(() => {
    if (!playerCharacter) return null
    return calculateEncumbrance(playerCharacter.attributes.strength, playerCharacter.equipment)
  }, [playerCharacter])

  const inCloseCombat = !!playerCombatant?.inCloseCombatWith
  const closeCombatTargetId = inCloseCombat ? playerCombatant?.inCloseCombatWith : null
  const effectiveTargetId = closeCombatTargetId ?? selectedTargetId

  const hpMax = playerCharacter?.derived.hitPoints ?? 10
  const fpMax = playerCharacter?.derived.fatiguePoints ?? 10
  const hpCurrent = playerCombatant?.currentHP ?? hpMax
  const fpCurrent = playerCombatant?.currentFP ?? fpMax
  const hpPercent = Math.max(0, (hpCurrent / hpMax) * 100)
  const fpPercent = Math.max(0, (fpCurrent / fpMax) * 100)

  const turnMovement = matchState?.turnMovement
  const inMovementPhase = turnMovement?.phase === 'moving'
  const movePointsRemaining = turnMovement?.movePointsRemaining ?? 0
  const freeRotationUsed = turnMovement?.freeRotationUsed ?? false

  const gamePhase: GamePhase = useMemo(() => {
    if (!matchState) {
      return inLobbyButNoMatch ? 'lobby_setup' : 'loading'
    }
    if (matchState.status === 'finished') return 'finished'
    if (pendingDefense?.defenderId === playerId) return 'defending'
    if (!isMyTurn) return 'waiting_opponent'
    if (!currentManeuver) return 'select_maneuver'
    return 'in_turn'
  }, [matchState, inLobbyButNoMatch, pendingDefense, playerId, isMyTurn, currentManeuver])

  const adapter = uiAdapter ?? getRulesetUiAdapter(matchState?.rulesetId)

  const availableManeuvers = useMemo(() => {
    const maneuvers = adapter.getManeuvers()
    const closeCombat = adapter.getCloseCombatManeuvers()
    return inCloseCombat
      ? maneuvers.filter(m => closeCombat.includes(m.type))
      : maneuvers
  }, [adapter, inCloseCombat])

  const defenseOptions = useMemo((): DefenseValues | null => {
    if (!playerCharacter || !playerCombatant || !pendingDefense) return null
    
    const derivedDodge = playerCharacter.derived.dodge
    const baseOpts = getDefenseOptions(playerCharacter, derivedDodge)
    const postureMods = getPostureModifiers(playerCombatant.posture)

    type ActiveDefenseType = 'dodge' | 'parry' | 'block'
    const getFinalValue = (type: ActiveDefenseType, base: number) => {
      return calculateDefenseValue(base, {
        retreat,
        dodgeAndDrop: type === 'dodge' ? dodgeAndDrop : false,
        inCloseCombat,
        defensesThisTurn: playerCombatant.defensesThisTurn,
        deceptivePenalty: pendingDefense.deceptivePenalty,
        postureModifier: postureMods.defenseVsMelee,
        defenseType: type
      })
    }

    return {
      dodge: getFinalValue('dodge', baseOpts.dodge),
      parry: baseOpts.parry ? getFinalValue('parry', baseOpts.parry.value) : null,
      block: baseOpts.block ? getFinalValue('block', baseOpts.block.value) : null,
      canRetreat: !playerCombatant.retreatedThisTurn
    }
  }, [playerCharacter, playerCombatant, pendingDefense, retreat, dodgeAndDrop, inCloseCombat])

  const attackerName = useMemo(() => {
    if (!pendingDefense || !matchState) return 'Enemy'
    const attackerCombatant = matchState.combatants.find(c => c.playerId === pendingDefense.attackerId)
    if (!attackerCombatant) return 'Enemy'
    return matchState.characters.find(c => c.id === attackerCombatant.characterId)?.name ?? 'Enemy'
  }, [pendingDefense, matchState])

  const targetCombatant = useMemo(() => {
    if (!effectiveTargetId || !matchState) return null
    return matchState.combatants.find(c => c.playerId === effectiveTargetId) ?? null
  }, [effectiveTargetId, matchState])

  const targetName = useMemo(() => {
    if (!targetCombatant || !matchState) return null
    return matchState.characters.find(c => c.id === targetCombatant.characterId)?.name ?? 'Enemy'
  }, [targetCombatant, matchState])

  const hitChanceInfo = useMemo((): HitChanceInfo | null => {
    if (!targetCombatant || !activeCombatant || !activeCharacter) return null

    const dist = hexDistance(
      activeCombatant.position.x, activeCombatant.position.z,
      targetCombatant.position.x, targetCombatant.position.z
    )

    const weapon = activeCharacter.equipment.find(e => 
      (e.type === 'melee' || e.type === 'ranged') && e.skillUsed
    )

    let baseSkillLevel = 10
    let skillName = 'Basic'

    if (weapon && weapon.skillUsed) {
      const skill = activeCharacter.skills.find(s => s.name === weapon.skillUsed)
      if (skill) {
        baseSkillLevel = skill.level
        skillName = skill.name
      }
    } else {
      const brawling = activeCharacter.skills.find(s => 
        s.name === 'Brawling' || s.name === 'Karate' || s.name === 'Broadsword'
      )
      if (brawling) {
        baseSkillLevel = brawling.level
        skillName = brawling.name
      }
    }

    const rangeMod = getRangePenalty(dist)
    const hitLocMod = getHitLocationPenalty(hitLocation)
    const shockMod = activeCombatant.shockPenalty > 0 ? -activeCombatant.shockPenalty : 0
    const deceptiveMod = deceptiveLevel > 0 ? -(deceptiveLevel * 2) : 0
    const rapidStrikeMod = rapidStrike ? -6 : 0
    const effectiveSkill = baseSkillLevel + rangeMod + hitLocMod + shockMod + deceptiveMod + rapidStrikeMod
    const prob = getHitProbability(effectiveSkill)

    let color = '#ff4444'
    if (prob >= 70) color = '#44ff44'
    else if (prob >= 40) color = '#ffcc00'

    return {
      dist,
      baseSkillLevel,
      skillName,
      rangeMod,
      hitLocMod,
      shockMod,
      deceptiveMod,
      rapidStrikeMod,
      effectiveSkill,
      prob,
      color
    }
  }, [targetCombatant, activeCombatant, activeCharacter, hitLocation, deceptiveLevel, rapidStrike])

  const canAttack = currentManeuver === 'attack' || currentManeuver === 'all_out_attack' || currentManeuver === 'move_and_attack'
  const canShowAttackBtn = canAttack && effectiveTargetId && !inMovementPhase

  const maxBots = 4 - lobbyPlayerCount
  const totalPlayers = lobbyPlayerCount + botCount

  const enemies = useMemo(() => {
    if (!matchState || !playerId) return []
    return matchState.combatants
      .filter(c => c.playerId !== playerId)
      .map(c => {
        const char = matchState.characters.find(ch => ch.id === c.characterId)
        return { id: c.playerId, name: char?.name ?? 'Unknown' }
      })
  }, [matchState, playerId])

  return {
    maneuvers: availableManeuvers,
    aoaVariants: adapter.getAoaVariants(),
    aodVariants: adapter.getAodVariants(),

    gamePhase,
    currentManeuver,
    inCloseCombat,
    inMovementPhase,
    movePointsRemaining,
    freeRotationUsed,
    effectiveTargetId,
    canAttack,
    canShowAttackBtn,

    playerCombatant,
    playerCharacter,
    activeCombatant,
    activeCharacter,
    encumbrance,
    hpMax,
    hpCurrent,
    hpPercent,
    fpMax,
    fpCurrent,
    fpPercent,

    targetCombatant,
    targetName,
    hitChanceInfo,

    defenseOptions,
    attackerName,
    defenseModifiers: {
      retreat,
      setRetreat,
      dodgeAndDrop,
      setDodgeAndDrop,
    },

    attackOptions: {
      hitLocation,
      setHitLocation,
      deceptiveLevel,
      setDeceptiveLevel,
      rapidStrike,
      setRapidStrike,
    },

    botCount,
    setBotCount,
    maxBots,
    totalPlayers,
    matchCode,
    isCreator,

    enemies,
  }
}

export const buildSelectManeuverPayload = (
  maneuver: ManeuverType,
  aoaVariant?: AOAVariant,
  aodVariant?: AODVariant
): CombatActionPayload => ({
  type: 'select_maneuver',
  maneuver,
  ...(aoaVariant && { aoaVariant }),
  ...(aodVariant && { aodVariant }),
})

export const buildAttackPayload = (
  targetId: string,
  hitLocation: HitLocation,
  deceptiveLevel: 0 | 1 | 2,
  rapidStrike: boolean
): CombatActionPayload => ({
  type: 'attack',
  targetId,
  hitLocation,
  deceptiveLevel,
  rapidStrike,
})

export const buildDefenseChoice = (
  type: DefenseType | 'none',
  retreat: boolean,
  dodgeAndDrop: boolean
): DefenseChoice => ({
  type,
  retreat,
  dodgeAndDrop: type === 'dodge' ? dodgeAndDrop : false,
})

export const buildWaitTriggerPayload = (trigger: WaitTrigger): CombatActionPayload => ({
  type: 'set_wait_trigger',
  trigger,
})

export const buildReadyActionPayload = (
  action: ReadyAction,
  itemId: string,
  targetSlot?: EquipmentSlot
): CombatActionPayload => ({
  type: 'ready_action',
  action,
  itemId,
  targetSlot,
})
