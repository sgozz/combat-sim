import type { MatchState, HexCoord, TurnMovementState, ReachableHexInfo, RulesetId, CharacterSheet, GridPosition } from '../types';
import type { ManeuverType, Posture, Equipment, Attributes, DerivedStats, Reach, ShieldSize, DamageType, HitLocation, DefenseType } from './gurps/types';
import type { CombatantState } from './index';
import type { GridSystem } from '../grid';
import { hexGrid, squareGrid8 } from '../grid';
import { isGurpsCharacter } from '../types';
import { isGurpsCombatant } from './guards';

export type MovementState = {
  position: HexCoord;
  facing: number;
  movePointsRemaining: number;
  freeRotationUsed: boolean;
  movedBackward: boolean;
  /** The sequence of hex coords the combatant walked through (for animation). */
  path?: HexCoord[];
};

export type PostureModifiers = {
  toHitMelee: number;
  toHitRanged: number;
  defenseVsMelee: number;
  defenseVsRanged: number;
  moveMultiplier: number;
};

export type EncumbranceInfo = {
  level: number;
  name: string;
  movePenalty: number;
  dodgePenalty: number;
  totalWeight: number;
  basicLift: number;
};

export type BotDefenseResult = {
  defenseType: DefenseType;
  defenseLabel: string;
  finalDefenseValue: number;
  canRetreat: boolean;
  retreatHex: GridPosition | null;
  parryWeaponName: string | null;
};

export type BotDefenseOptions = {
  targetCharacter: CharacterSheet;
  targetCombatant: CombatantState;
  attackerPosition: GridPosition;
  allCombatants: CombatantState[];
  distance: number;
  relativeDir: number;
  isRanged: boolean;
  findRetreatHex: (defenderPos: GridPosition, attackerPos: GridPosition, combatants: CombatantState[]) => GridPosition | null;
};

export type EffectiveSkillOptions = {
  baseSkill: number;
  attackerCombatant: CombatantState;
  weapon: Equipment;
  distance: number;
  targetId: string;
  isRanged: boolean;
  deceptiveLevel: number;
  rapidStrike: boolean;
  hitLocation: HitLocation;
};

export type DefenseResolutionOptions = {
  defenderCharacter: CharacterSheet;
  defenderCombatant: CombatantState;
  attackerCombatant: CombatantState;
  attackerCharacter: CharacterSheet;
  defenseChoice: {
    defenseType: 'dodge' | 'parry' | 'block';
    retreat: boolean;
    dodgeAndDrop: boolean;
  };
  deceptivePenalty: number;
  feintPenalty?: number;
};

export type DefenseResolutionResult = {
  baseDefense: number;
  defenseLabel: string;
  finalDefenseValue: number;
  canRetreat: boolean;
  parryWeaponName: string | null;
  sameWeaponParry: boolean;
  inCloseCombat: boolean;
};

export type ManeuverInfo = {
  aoaDamageBonus: number;
  isMultiAttack: boolean;
  canDefend: boolean;
  defenseDescription: string | null;
  canRapidStrike: boolean;
};

/**
 * Interface for combat-related ruleset logic.
 * Handles attack/defense resolution, modifiers, and bot AI decisions.
 */
export type CombatDomain = {
  /** Resolves an attack roll against a target skill. */
  resolveAttackRoll: (skill: number, random?: () => number) => GurpsAttackRollResult;
  /** Resolves a defense roll against a defense value. */
  resolveDefenseRoll: (defenseValue: number, random?: () => number) => GurpsDefenseRollResult;
  /** Calculates the final defense value including all modifiers. */
  calculateDefenseValue: (baseDefense: number, options: {
    retreat: boolean;
    dodgeAndDrop: boolean;
    inCloseCombat: boolean;
    defensesThisTurn: number;
    deceptivePenalty: number;
    postureModifier: number;
    defenseType: 'dodge' | 'parry' | 'block';
    sameWeaponParry?: boolean;
    lostBalance?: boolean;
  }, character?: CharacterSheet) => number;
  /** Returns available defense options for a character. */
  getDefenseOptions: (character: CharacterSheet, dodgeValue: number) => GurpsDefenseOptions;
  /** Calculates range penalty based on distance. */
  getRangePenalty: (distance: number) => number;
  /** Returns modifiers based on current posture. */
  getPostureModifiers: (posture: Posture) => PostureModifiers;
  /** Checks if an attack is possible at a given distance. */
  canAttackAtDistance: (reach: Reach, distance: number) => boolean;
  /** Returns modifiers for close combat attacks. */
  getCloseCombatAttackModifiers: (weapon: Equipment, distance: number) => GurpsCloseCombatAttackModifiers;
  /** Returns modifiers for close combat defense. */
  getCloseCombatDefenseModifiers: (weaponReach: Reach | undefined, shieldSize: ShieldSize | undefined, inCloseCombat: boolean) => GurpsCloseCombatDefenseModifiers;
  /** Parses reach string into min/max values. */
  parseReach: (reach: Reach) => { min: number; max: number; hasC: boolean };
  /** Returns penalty for hitting a specific location. */
  getHitLocationPenalty: (location: HitLocation) => number;
  rollCriticalHitTable?: (random?: () => number) => { roll: number; effect: GurpsCriticalHitEffect };
  rollCriticalMissTable?: (random?: () => number) => { roll: number; effect: GurpsCriticalMissEffect };
  applyCriticalHitDamage?: (baseDamage: number, effect: GurpsCriticalHitEffect, formula: string, random?: () => number) => { damage: number; description: string };
  getCriticalMissDescription?: (effect: GurpsCriticalMissEffect) => string;
  /** Selects the best defense for a bot-controlled combatant. */
  selectBotDefense?: (options: BotDefenseOptions) => BotDefenseResult | null;
  /** Calculates effective skill including all situational modifiers. */
  calculateEffectiveSkill?: (options: EffectiveSkillOptions) => number;
  /** High-level defense resolution combining choice and modifiers. */
  resolveDefense?: (options: DefenseResolutionOptions) => DefenseResolutionResult | null;
  /** Returns maneuver-related info for an attacker. */
  getAttackerManeuverInfo?: (combatant: CombatantState) => ManeuverInfo;
  /** Returns maneuver-related info for a defender. */
  getDefenderManeuverInfo?: (combatant: CombatantState) => ManeuverInfo;
  /** Applies effects of 'Dodge and Drop' to a combatant. */
  applyDodgeAndDrop?: (combatant: CombatantState) => CombatantState;
};

/**
 * Interface for damage-related ruleset logic.
 */
export type DamageDomain = {
  /** Rolls damage based on a formula. */
  rollDamage: (formula: string, random?: () => number) => GurpsDamageRoll;
  /** Applies wounding multipliers based on damage type. */
  applyDamageMultiplier: (baseDamage: number, damageType: DamageType) => number;
  /** Resolves a Health check to avoid unconsciousness/death. */
  rollHTCheck: (ht: number, currentHP: number, maxHP: number, random?: () => number, character?: CharacterSheet) => GurpsHTCheckResult;
  /** Returns wounding multiplier for a specific hit location. */
  getHitLocationWoundingMultiplier: (location: HitLocation, damageType: DamageType) => number;
  /** Returns DR for a specific hit location. */
  getLocationDR?: (character: CharacterSheet, hitLocation: HitLocation) => number;
};

/**
 * Interface for close combat (grappling) logic.
 */
export type CloseCombatDomain = {
  /** Resolves a Quick Contest between two skills. */
  quickContest: (attackerSkill: number, defenderSkill: number, random?: () => number) => GurpsQuickContestResult;
  /** Resolves a grapple attempt. */
  resolveGrappleAttempt: (attackerDX: number, attackerSkill: number, defenderDX: number, canDefend: boolean, random?: () => number) => GurpsGrappleAttemptResult;
  /** Resolves an attempt to break free from a grapple. */
  resolveBreakFree: (defenderST: number, defenderSkill: number, controlPoints: number, random?: () => number) => GurpsBreakFreeResult;
  /** Resolves a specific grappling technique (pin, choke, etc.). */
  resolveGrappleTechnique: (technique: 'throw' | 'lock' | 'choke' | 'pin', skill: number, ST: number, controlPoints: number, random?: () => number) => GurpsGrappleTechniqueResult;
};

export type PF2RollResultType = {
  roll: number;
  modifier: number;
  total: number;
  dc: number;
  degree: 'critical_success' | 'success' | 'failure' | 'critical_failure';
  natural20: boolean;
  natural1: boolean;
};

/**
 * Interface for Pathfinder 2e specific logic.
 */
export type PF2Domain = {
  /** Resolves a d20 check against a DC. */
  rollCheck: (modifier: number, dc: number, random?: () => number) => PF2RollResultType;
  /** Rolls damage for PF2. */
  rollDamage: (formula: string, damageType: string, random?: () => number) => { total: number; rolls: number[]; modifier: number };
  /** Calculates ability modifier from score. */
  getAbilityModifier: (score: number) => number;
  /** Calculates proficiency bonus. */
  getProficiencyBonus: (proficiency: string, level: number) => number;
  /** Calculates Multiple Attack Penalty (MAP). */
  getMultipleAttackPenalty: (attackNumber: number, isAgile: boolean) => number;
};

/**
 * Main adapter interface for server-side ruleset logic.
 * Each ruleset must implement this to handle game state transitions.
 */
export type ServerRulesetAdapter = {
   id: RulesetId;
   gridSystem: GridSystem;
   hasFacingArcs: boolean;
   /** Advances the match state to the next turn. */
   advanceTurn: (state: MatchState) => MatchState;
  /** Initializes movement state at the start of a turn. */
  initializeTurnMovement: (
    position: HexCoord,
    facing: number,
    maneuver: ManeuverType | null,
    basicMove: number,
    posture: Posture
  ) => TurnMovementState;
  /** Calculates reachable hexes for the current movement state. */
  calculateReachableHexesInfo: (state: TurnMovementState, occupiedHexes: HexCoord[], mapDefinition?: import('../map/types').MapDefinition) => ReachableHexInfo[];
  /** Converts grid coordinates to hex coordinates. */
  gridToHex: (pos: { x: number; z: number }) => HexCoord;
  /** Converts hex coordinates to grid coordinates. */
  hexToGrid: (hex: HexCoord) => { x: number; y: number; z: number };
  /** Executes a move to a target hex. */
  executeMove?: (state: MovementState, targetHex: HexCoord, occupiedHexes: HexCoord[]) => MovementState | null;
  /** Executes a rotation to a new facing. */
  executeRotation?: (state: MovementState, newFacing: number) => MovementState | null;
  /** Calculates derived stats from base attributes. */
  calculateDerivedStats: (attributes: Attributes) => DerivedStats;
  getPostureModifiers?: (posture: Posture) => PostureModifiers;
  calculateEncumbrance?: (strength: number, equipment: Equipment[]) => EncumbranceInfo;
  canChangePostureFree?: (from: Posture, to: Posture) => boolean;
  
  /** Domain-specific logic (optional depending on ruleset) */
  combat?: CombatDomain;
  damage?: DamageDomain;
  closeCombat?: CloseCombatDomain;
  pf2?: PF2Domain;
  
  // Legacy flat methods (for backward compatibility)
  resolveAttackRoll?: (skill: number, random?: () => number) => GurpsAttackRollResult;
  resolveDefenseRoll?: (defenseValue: number, random?: () => number) => GurpsDefenseRollResult;
  calculateDefenseValue?: (baseDefense: number, options: {
    retreat: boolean;
    dodgeAndDrop: boolean;
    inCloseCombat: boolean;
    defensesThisTurn: number;
    deceptivePenalty: number;
    postureModifier: number;
    defenseType: 'dodge' | 'parry' | 'block';
    sameWeaponParry?: boolean;
    lostBalance?: boolean;
    feintPenalty?: number;
  }, character?: CharacterSheet) => number;
  getDefenseOptions?: (character: CharacterSheet, dodgeValue: number) => GurpsDefenseOptions;
  getRangePenalty?: (distance: number) => number;
  canAttackAtDistance?: (reach: Reach, distance: number) => boolean;
  getCloseCombatAttackModifiers?: (weapon: Equipment, distance: number) => GurpsCloseCombatAttackModifiers;
  getCloseCombatDefenseModifiers?: (weaponReach: Reach | undefined, shieldSize: ShieldSize | undefined, inCloseCombat: boolean) => GurpsCloseCombatDefenseModifiers;
  parseReach?: (reach: Reach) => { min: number; max: number; hasC: boolean };
  getHitLocationPenalty?: (location: HitLocation) => number;
  rollCriticalHitTable?: (random?: () => number) => { roll: number; effect: GurpsCriticalHitEffect };
  rollCriticalMissTable?: (random?: () => number) => { roll: number; effect: GurpsCriticalMissEffect };
  applyCriticalHitDamage?: (baseDamage: number, effect: GurpsCriticalHitEffect, formula: string, random?: () => number) => { damage: number; description: string };
  getCriticalMissDescription?: (effect: GurpsCriticalMissEffect) => string;
  rollDamage?: (formula: string, random?: () => number) => GurpsDamageRoll;
  applyDamageMultiplier?: (baseDamage: number, damageType: DamageType) => number;
  rollHTCheck?: (ht: number, currentHP: number, maxHP: number, random?: () => number) => GurpsHTCheckResult;
  getHitLocationWoundingMultiplier?: (location: HitLocation, damageType: DamageType) => number;
  quickContest?: (attackerSkill: number, defenderSkill: number, random?: () => number) => GurpsQuickContestResult;
  resolveGrappleAttempt?: (attackerDX: number, attackerSkill: number, defenderDX: number, canDefend: boolean, random?: () => number) => GurpsGrappleAttemptResult;
  resolveBreakFree?: (defenderST: number, defenderSkill: number, controlPoints: number, random?: () => number) => GurpsBreakFreeResult;
  resolveGrappleTechnique?: (technique: 'throw' | 'lock' | 'choke' | 'pin', skill: number, ST: number, controlPoints: number, random?: () => number) => GurpsGrappleTechniqueResult;
};

import {
  advanceTurn as gurpsAdvanceTurn,
  initializeTurnMovement as gurpsInitializeTurnMovement,
  calculateReachableHexesInfo as gurpsCalculateReachableHexesInfo,
  gridToHex as gurpsGridToHex,
  hexToGrid as gurpsHexToGrid,
  executeMove as gurpsExecuteMove,
  executeRotation as gurpsExecuteRotation,
  calculateDerivedStats as gurpsCalculateDerivedStats,
  getPostureModifiers as gurpsGetPostureModifiers,
  calculateEncumbrance as gurpsCalculateEncumbrance,
  canChangePostureFree as gurpsCanChangePostureFree,
  resolveAttackRoll as gurpsResolveAttackRoll,
  resolveDefenseRoll as gurpsResolveDefenseRoll,
  calculateDefenseValue as gurpsCalculateDefenseValue,
  getDefenseOptions as gurpsGetDefenseOptions,
  getRangePenalty as gurpsGetRangePenalty,
  canAttackAtDistance as gurpsCanAttackAtDistance,
  getCloseCombatAttackModifiers as gurpsGetCloseCombatAttackModifiers,
  getCloseCombatDefenseModifiers as gurpsGetCloseCombatDefenseModifiers,
  parseReach as gurpsParseReach,
  getHitLocationPenalty as gurpsGetHitLocationPenalty,
  rollCriticalHitTable as gurpsRollCriticalHitTable,
  rollCriticalMissTable as gurpsRollCriticalMissTable,
  applyCriticalHitDamage as gurpsApplyCriticalHitDamage,
  getCriticalMissDescription as gurpsGetCriticalMissDescription,
  rollDamage as gurpsRollDamage,
  applyDamageMultiplier as gurpsApplyDamageMultiplier,
  rollHTCheck as gurpsRollHTCheck,
  getHitLocationWoundingMultiplier as gurpsGetHitLocationWoundingMultiplier,
  getLocationDR as gurpsGetLocationDR,
  quickContest as gurpsQuickContest,
  resolveGrappleAttempt as gurpsResolveGrappleAttempt,
  resolveBreakFree as gurpsResolveBreakFree,
  resolveGrappleTechnique as gurpsResolveGrappleTechnique,
} from './gurps/rules';
import type {
  AttackRollResult as GurpsAttackRollResult,
  DefenseRollResult as GurpsDefenseRollResult,
  DamageRoll as GurpsDamageRoll,
  HTCheckResult as GurpsHTCheckResult,
  CriticalHitEffect as GurpsCriticalHitEffect,
  CriticalMissEffect as GurpsCriticalMissEffect,
  CloseCombatAttackModifiers as GurpsCloseCombatAttackModifiers,
  CloseCombatDefenseModifiers as GurpsCloseCombatDefenseModifiers,
  QuickContestResult as GurpsQuickContestResult,
  GrappleAttemptResult as GurpsGrappleAttemptResult,
  BreakFreeResult as GurpsBreakFreeResult,
  GrappleTechniqueResult as GurpsGrappleTechniqueResult,
  DefenseOptions as GurpsDefenseOptions,
} from './gurps/rules';

import {
  advanceTurn as pf2AdvanceTurn,
  initializeTurnMovement as pf2InitializeTurnMovement,
  calculateReachableHexesInfo as pf2CalculateReachableHexesInfo,
  gridToHex as pf2GridToHex,
  hexToGrid as pf2HexToGrid,
  executeMove as pf2ExecuteMove,
  rollCheck as pf2RollCheck,
  rollDamage as pf2RollDamage,
  getAbilityModifier as pf2GetAbilityModifier,
  getProficiencyBonus as pf2GetProficiencyBonus,
  getMultipleAttackPenalty as pf2GetMultipleAttackPenalty,
} from './pf2/rules';
import type { DamageRoll as PF2DamageRoll } from './pf2/rules';
import type { Proficiency as PF2Proficiency, PF2DamageType } from './pf2/types';

const pf2CombatDomain: CombatDomain = {
  resolveAttackRoll: (skill: number, random: () => number = Math.random): GurpsAttackRollResult => {
    const result = pf2RollCheck(skill, 10, random);
    const margin = result.total - result.dc;
    const hit = result.degree === 'success' || result.degree === 'critical_success';
    const critical = result.degree === 'critical_success';
    const criticalMiss = result.degree === 'critical_failure';
    return {
      roll: { roll: result.roll, dice: [result.roll], target: skill, margin, success: hit, critical },
      hit,
      critical,
      criticalMiss,
      autoDefenseFails: critical,
    };
  },
  resolveDefenseRoll: (): GurpsDefenseRollResult => {
    return {
      roll: { roll: 0, dice: [], target: 0, margin: 0, success: false, critical: false },
      defended: false,
      criticalSuccess: false,
      criticalFailure: false,
    };
  },
  calculateDefenseValue: (): number => 0,
  getDefenseOptions: (): GurpsDefenseOptions => ({
    dodge: 0,
    parry: null,
    block: null,
  }),
  getRangePenalty: (): number => 0,
  getPostureModifiers: (): PostureModifiers => ({
    toHitMelee: 0,
    toHitRanged: 0,
    defenseVsMelee: 0,
    defenseVsRanged: 0,
    moveMultiplier: 1,
  }),
  canAttackAtDistance: (): boolean => true,
  getCloseCombatAttackModifiers: (): GurpsCloseCombatAttackModifiers => ({
    toHit: 0,
    canAttack: false,
    reason: 'PF2 does not use GURPS close combat rules',
  }),
  getCloseCombatDefenseModifiers: (): GurpsCloseCombatDefenseModifiers => ({
    dodge: 0,
    parry: 0,
    block: 0,
    retreatBonus: 0,
    canParry: false,
    canBlock: false,
  }),
  parseReach: (): { min: number; max: number; hasC: boolean } => ({ min: 1, max: 1, hasC: false }),
  getHitLocationPenalty: (): number => 0,
  rollCriticalHitTable: undefined,
  rollCriticalMissTable: undefined,
  applyCriticalHitDamage: undefined,
  getCriticalMissDescription: undefined,
  selectBotDefense: (): BotDefenseResult | null => null,
  calculateEffectiveSkill: (options: EffectiveSkillOptions): number => options.baseSkill,
  resolveDefense: (): DefenseResolutionResult | null => null,
  getAttackerManeuverInfo: (): ManeuverInfo => ({
    aoaDamageBonus: 0,
    isMultiAttack: false,
    canDefend: true,
    defenseDescription: null,
    canRapidStrike: false,
  }),
  getDefenderManeuverInfo: (): ManeuverInfo => ({
    aoaDamageBonus: 0,
    isMultiAttack: false,
    canDefend: true,
    defenseDescription: null,
    canRapidStrike: false,
  }),
  applyDodgeAndDrop: (combatant: CombatantState): CombatantState => combatant,
};

const pf2DamageDomain: DamageDomain = {
  rollDamage: (formula: string, random: () => number = Math.random): GurpsDamageRoll => {
    const pf2Result: PF2DamageRoll = pf2RollDamage(formula, 'bludgeoning', random);
    return {
      total: pf2Result.total,
      rolls: pf2Result.rolls,
      modifier: pf2Result.modifier,
    };
  },
  applyDamageMultiplier: (baseDamage: number): number => baseDamage,
  rollHTCheck: (): GurpsHTCheckResult => ({
    roll: 0,
    target: 0,
    success: false,
    margin: 0,
  }),
  getHitLocationWoundingMultiplier: (): number => 1,
};

const gurpsSelectBotDefense = (options: BotDefenseOptions): BotDefenseResult => {
  const { targetCharacter, targetCombatant, attackerPosition, distance, relativeDir, isRanged, findRetreatHex } = options;
  
  if (!isGurpsCharacter(targetCharacter) || !isGurpsCombatant(targetCombatant)) {
    return {
      defenseType: 'dodge',
      defenseLabel: 'Dodge',
      finalDefenseValue: 10,
      canRetreat: false,
      retreatHex: null,
      parryWeaponName: null,
    };
  }
  
  const targetEncumbrance = gurpsCalculateEncumbrance(
    targetCharacter.attributes.strength,
    targetCharacter.equipment
  );
  const effectiveDodge = targetCharacter.derived.dodge + targetEncumbrance.dodgePenalty;
  const defenseOptions = gurpsGetDefenseOptions(targetCharacter, effectiveDodge);
  const targetWeapon = targetCharacter.equipment.find((e: Equipment) => e.type === 'melee');
  const targetShield = targetCharacter.equipment.find((e: Equipment) => e.type === 'shield');
  const inCloseCombat = distance === 0;
  const ccDefMods = gurpsGetCloseCombatDefenseModifiers(
    targetWeapon?.reach,
    targetShield?.shieldSize,
    inCloseCombat
  );
  
  let defenseMod = 0;
  if (relativeDir === 2 || relativeDir === 4) defenseMod = -2;
  if (targetCombatant.statusEffects.includes('defending')) defenseMod += 1;
  
  const targetPosture = gurpsGetPostureModifiers(targetCombatant.posture);
  const postureDefBonus = isRanged ? targetPosture.defenseVsRanged : targetPosture.defenseVsMelee;
  defenseMod += postureDefBonus;
  
  const targetManeuver = targetCombatant.maneuver;
  const aodVariant = targetCombatant.aodVariant;
  const dodgeAodBonus = (targetManeuver === 'all_out_defense' && aodVariant === 'increased_dodge') ? 2 : 0;
  const parryAodBonus = (targetManeuver === 'all_out_defense' && aodVariant === 'increased_parry') ? 2 : 0;
  const blockAodBonus = (targetManeuver === 'all_out_defense' && aodVariant === 'increased_block') ? 2 : 0;
  const lostBalancePenalty = targetCombatant.statusEffects.includes('lost_balance') ? -2 : 0;
  
  let bestDefense = defenseOptions.dodge + ccDefMods.dodge + defenseMod + dodgeAodBonus + lostBalancePenalty;
  let defenseUsed: DefenseType = 'dodge';
  let defenseLabel = "Dodge";
  let parryWeaponName: string | null = null;
  
  if (ccDefMods.canParry && defenseOptions.parry) {
    const parryWeapon = defenseOptions.parry.weapon;
    const isSameWeaponParry = targetCombatant.parryWeaponsUsedThisTurn.includes(parryWeapon);
    const sameWeaponPenalty = isSameWeaponParry ? -4 : 0;
    const multiDefPenalty = isSameWeaponParry 
      ? (targetCombatant.defensesThisTurn > 1 ? -(targetCombatant.defensesThisTurn - 1) : 0)
      : -targetCombatant.defensesThisTurn;
    const parryValue = defenseOptions.parry.value + ccDefMods.parry + defenseMod + parryAodBonus + sameWeaponPenalty + multiDefPenalty + lostBalancePenalty;
    if (parryValue > bestDefense) {
      bestDefense = parryValue;
      defenseUsed = 'parry';
      defenseLabel = `Parry (${parryWeapon})`;
      parryWeaponName = parryWeapon;
    }
  }
  if (ccDefMods.canBlock && defenseOptions.block) {
    const blockValue = defenseOptions.block.value + ccDefMods.block + defenseMod + blockAodBonus - targetCombatant.defensesThisTurn + lostBalancePenalty;
    if (blockValue > bestDefense) {
      bestDefense = blockValue;
      defenseUsed = 'block';
      defenseLabel = `Block (${defenseOptions.block.shield})`;
      parryWeaponName = null;
    }
  }
  
  const wantsRetreat = !targetCombatant.retreatedThisTurn;
  const retreatHex = wantsRetreat ? findRetreatHex(targetCombatant.position, attackerPosition, options.allCombatants) : null;
  const canRetreat = wantsRetreat && retreatHex !== null;
  const retreatBonus = canRetreat ? (defenseUsed === 'dodge' ? 3 : 1) : 0;
  const finalDefenseValue = bestDefense + retreatBonus;
  
  return {
    defenseType: defenseUsed,
    defenseLabel,
    finalDefenseValue,
    canRetreat,
    retreatHex,
    parryWeaponName,
  };
};

const gurpsCalculateEffectiveSkill = (options: EffectiveSkillOptions): number => {
  const { baseSkill, attackerCombatant, weapon, distance, targetId, isRanged, deceptiveLevel, rapidStrike, hitLocation } = options;
  
  if (!isGurpsCombatant(attackerCombatant)) {
    return baseSkill;
  }
  
  let skill = baseSkill;
  const attackerManeuver = attackerCombatant.maneuver;
  
  if (isRanged) {
    skill += gurpsGetRangePenalty(distance);
  }
  
  const closeCombatMods = gurpsGetCloseCombatAttackModifiers(weapon, distance);
  skill += closeCombatMods.toHit;
  
  if (attackerManeuver === 'all_out_attack') {
    if (attackerCombatant.aoaVariant === 'determined') {
      skill += 4;
    }
  } else if (attackerManeuver === 'move_and_attack') {
    skill = Math.min(skill - 4, 9);
  }
  
  if (attackerCombatant.aimTurns > 0 && attackerCombatant.aimTargetId === targetId) {
    const weaponAcc = weapon?.accuracy ?? 0;
    const aimBonus = weaponAcc + Math.min(attackerCombatant.aimTurns - 1, 2);
    skill += aimBonus;
  }
  
  if (attackerCombatant.evaluateBonus > 0 && attackerCombatant.evaluateTargetId === targetId) {
    skill += attackerCombatant.evaluateBonus;
  }
  
  if (attackerCombatant.shockPenalty > 0) {
    skill -= attackerCombatant.shockPenalty;
  }
  
  if (deceptiveLevel > 0) {
    skill -= deceptiveLevel * 2;
  }
  
  if (rapidStrike) {
    skill -= 6;
  }
  
  const attackerPosture = gurpsGetPostureModifiers(attackerCombatant.posture);
  skill += isRanged ? attackerPosture.toHitRanged : attackerPosture.toHitMelee;
  
  skill += gurpsGetHitLocationPenalty(hitLocation);
  
  return skill;
};

const calculateHexDistance = (a: GridPosition, b: GridPosition): number => {
  const dq = Math.abs(a.x - b.x);
  const dr = Math.abs(a.z - b.z);
  const ds = Math.abs((-a.x - a.z) - (-b.x - b.z));
  return Math.max(dq, dr, ds);
};

const calculateFacing = (from: GridPosition, to: GridPosition): number => {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  if (dx === 0 && dz === 0) return 0;
  const angle = Math.atan2(dz, dx) * (180 / Math.PI);
  const normalized = ((angle + 360) % 360);
  return Math.round(normalized / 60) % 6;
};

const gurpsGetAttackerManeuverInfo = (combatant: CombatantState): ManeuverInfo => {
  if (!isGurpsCombatant(combatant)) {
    return {
      aoaDamageBonus: 0,
      isMultiAttack: false,
      canDefend: true,
      defenseDescription: null,
      canRapidStrike: false,
    };
  }
  const maneuver = combatant.maneuver;
  const aoaVariant = combatant.aoaVariant;
  
  return {
    aoaDamageBonus: (maneuver === 'all_out_attack' && aoaVariant === 'strong') ? 2 : 0,
    isMultiAttack: maneuver === 'all_out_attack' && aoaVariant === 'double',
    canDefend: maneuver !== 'all_out_attack',
    defenseDescription: null,
    canRapidStrike: maneuver === 'attack',
  };
};

const gurpsGetDefenderManeuverInfo = (combatant: CombatantState): ManeuverInfo => {
  if (!isGurpsCombatant(combatant)) {
    return {
      aoaDamageBonus: 0,
      isMultiAttack: false,
      canDefend: true,
      defenseDescription: null,
      canRapidStrike: false,
    };
  }
  const maneuver = combatant.maneuver;
  const aodVariant = combatant.aodVariant;
  
  let defenseDescription: string | null = null;
  if (maneuver === 'all_out_defense' && aodVariant) {
    defenseDescription = `AoD (${aodVariant.replace('increased_', '+2 ').replace('_', ' ')})`;
  }
  
  return {
    aoaDamageBonus: 0,
    isMultiAttack: false,
    canDefend: maneuver !== 'all_out_attack',
    defenseDescription,
    canRapidStrike: false,
  };
};

const gurpsResolveDefense = (options: DefenseResolutionOptions): DefenseResolutionResult => {
  const { defenderCharacter, defenderCombatant, attackerCombatant, attackerCharacter, defenseChoice, deceptivePenalty, feintPenalty } = options;
  
  if (!isGurpsCharacter(defenderCharacter) || !isGurpsCombatant(defenderCombatant)) {
    return {
      baseDefense: 0,
      defenseLabel: 'Unavailable',
      finalDefenseValue: 3,
      canRetreat: false,
      parryWeaponName: null,
      sameWeaponParry: false,
      inCloseCombat: false,
    };
  }
  
  const defenderEncumbrance = gurpsCalculateEncumbrance(
    defenderCharacter.attributes.strength,
    defenderCharacter.equipment
  );
  const effectiveDefenderDodge = defenderCharacter.derived.dodge + defenderEncumbrance.dodgePenalty;
  const defenseOptions = gurpsGetDefenseOptions(defenderCharacter, effectiveDefenderDodge);
  const distance = calculateHexDistance(attackerCombatant.position, defenderCombatant.position);
  const inCloseCombat = distance === 0;
  const defenderWeapon = defenderCharacter.equipment.find((e: Equipment) => e.type === 'melee');
  const defenderShield = defenderCharacter.equipment.find((e: Equipment) => e.type === 'shield');
  const ccDefMods = gurpsGetCloseCombatDefenseModifiers(
    defenderWeapon?.reach,
    defenderShield?.shieldSize,
    inCloseCombat
  );
  
  let baseDefense = 0;
  let defenseLabel = '';
  let parryWeaponName: string | null = null;
  let sameWeaponParry = false;
  
  switch (defenseChoice.defenseType) {
    case 'dodge':
      baseDefense = defenseOptions.dodge + ccDefMods.dodge;
      defenseLabel = 'Dodge';
      break;
    case 'parry':
      if (!defenseOptions.parry || !ccDefMods.canParry) {
        baseDefense = 3;
        defenseLabel = 'Parry (unavailable)';
      } else {
        baseDefense = defenseOptions.parry.value + ccDefMods.parry;
        defenseLabel = `Parry (${defenseOptions.parry.weapon})`;
        parryWeaponName = defenseOptions.parry.weapon;
        sameWeaponParry = defenderCombatant.parryWeaponsUsedThisTurn.includes(parryWeaponName);
      }
      break;
    case 'block':
      if (!defenseOptions.block || !ccDefMods.canBlock) {
        baseDefense = 3;
        defenseLabel = 'Block (unavailable)';
      } else {
        baseDefense = defenseOptions.block.value + ccDefMods.block;
        defenseLabel = `Block (${defenseOptions.block.shield})`;
      }
      break;
  }
  
  const attackerPos = attackerCombatant.position;
  const defenderPos = defenderCombatant.position;
  const attackDirection = calculateFacing(defenderPos, attackerPos);
  const relativeDir = (attackDirection - defenderCombatant.facing + 6) % 6;
  
  let defenseMod = 0;
  if (relativeDir === 2 || relativeDir === 4) defenseMod = -2;
  if (defenderCombatant.statusEffects.includes('defending')) defenseMod += 1;
  
  const aodVariant = defenderCombatant.aodVariant;
  if (defenderCombatant.maneuver === 'all_out_defense' && aodVariant) {
    if ((aodVariant === 'increased_dodge' && defenseChoice.defenseType === 'dodge') ||
        (aodVariant === 'increased_parry' && defenseChoice.defenseType === 'parry') ||
        (aodVariant === 'increased_block' && defenseChoice.defenseType === 'block')) {
      defenseMod += 2;
    }
  }
  
  const isRanged = isGurpsCharacter(attackerCharacter) ? attackerCharacter.equipment[0]?.type === 'ranged' : false;
  const defenderPosture = gurpsGetPostureModifiers(defenderCombatant.posture);
  defenseMod += isRanged ? defenderPosture.defenseVsRanged : defenderPosture.defenseVsMelee;
  
  const canRetreat = defenseChoice.retreat && !defenderCombatant.retreatedThisTurn;
  
  const finalDefenseValue = gurpsCalculateDefenseValue(baseDefense, {
    retreat: canRetreat,
    dodgeAndDrop: defenseChoice.dodgeAndDrop && defenseChoice.defenseType === 'dodge',
    inCloseCombat,
    defensesThisTurn: defenderCombatant.defensesThisTurn,
    deceptivePenalty,
    feintPenalty,
    postureModifier: defenseMod,
    defenseType: defenseChoice.defenseType,
    sameWeaponParry,
    lostBalance: defenderCombatant.statusEffects.includes('lost_balance'),
  });
  
  return {
    baseDefense,
    defenseLabel,
    finalDefenseValue,
    canRetreat,
    parryWeaponName,
    sameWeaponParry,
    inCloseCombat,
  };
};

const gurpsGetDefenseOptionsWrapper = (character: CharacterSheet, dodgeValue: number): GurpsDefenseOptions => {
  if (!isGurpsCharacter(character)) {
    return { dodge: dodgeValue, parry: null, block: null };
  }
  return gurpsGetDefenseOptions(character, dodgeValue);
};

const gurpsGetLocationDRWrapper = (character: CharacterSheet, hitLocation: HitLocation): number => {
  if (!isGurpsCharacter(character)) {
    return 0;
  }
  return gurpsGetLocationDR(character, hitLocation);
};

const gurpsCalculateDefenseValueWrapper = (
  baseDefense: number,
  options: {
    retreat: boolean;
    dodgeAndDrop: boolean;
    inCloseCombat: boolean;
    defensesThisTurn: number;
    deceptivePenalty: number;
    postureModifier: number;
    defenseType: 'dodge' | 'parry' | 'block';
    sameWeaponParry?: boolean;
    lostBalance?: boolean;
    feintPenalty?: number;
  },
  character?: CharacterSheet
): number => {
  if (character && isGurpsCharacter(character)) {
    return gurpsCalculateDefenseValue(baseDefense, options, character);
  }
  return gurpsCalculateDefenseValue(baseDefense, options);
};

const gurpsRollHTCheckWrapper = (
  ht: number,
  currentHP: number,
  maxHP: number,
  random?: () => number,
  character?: CharacterSheet
): GurpsHTCheckResult => {
  if (character && isGurpsCharacter(character)) {
    return gurpsRollHTCheck(ht, currentHP, maxHP, random, character);
  }
  return gurpsRollHTCheck(ht, currentHP, maxHP, random);
};

const gurpsCombatDomain: CombatDomain = {
   resolveAttackRoll: gurpsResolveAttackRoll,
   resolveDefenseRoll: gurpsResolveDefenseRoll,
   calculateDefenseValue: gurpsCalculateDefenseValueWrapper,
   getDefenseOptions: gurpsGetDefenseOptionsWrapper,
  getRangePenalty: gurpsGetRangePenalty,
  getPostureModifiers: gurpsGetPostureModifiers,
  canAttackAtDistance: gurpsCanAttackAtDistance,
  getCloseCombatAttackModifiers: gurpsGetCloseCombatAttackModifiers,
  getCloseCombatDefenseModifiers: gurpsGetCloseCombatDefenseModifiers,
  parseReach: gurpsParseReach,
  getHitLocationPenalty: gurpsGetHitLocationPenalty,
  rollCriticalHitTable: gurpsRollCriticalHitTable,
  rollCriticalMissTable: gurpsRollCriticalMissTable,
  applyCriticalHitDamage: gurpsApplyCriticalHitDamage,
  getCriticalMissDescription: gurpsGetCriticalMissDescription,
  selectBotDefense: gurpsSelectBotDefense,
  calculateEffectiveSkill: gurpsCalculateEffectiveSkill,
  resolveDefense: gurpsResolveDefense,
  getAttackerManeuverInfo: gurpsGetAttackerManeuverInfo,
  getDefenderManeuverInfo: gurpsGetDefenderManeuverInfo,
  applyDodgeAndDrop: (combatant: CombatantState): CombatantState => {
    if (isGurpsCombatant(combatant)) {
      return { ...combatant, posture: 'prone' };
    }
    return combatant;
  },
};

const gurpsDamageDomain: DamageDomain = {
   rollDamage: gurpsRollDamage,
   applyDamageMultiplier: gurpsApplyDamageMultiplier,
   rollHTCheck: gurpsRollHTCheckWrapper,
   getHitLocationWoundingMultiplier: gurpsGetHitLocationWoundingMultiplier,
   getLocationDR: gurpsGetLocationDRWrapper,
};

const gurpsCloseCombatDomain: CloseCombatDomain = {
  quickContest: gurpsQuickContest,
  resolveGrappleAttempt: gurpsResolveGrappleAttempt,
  resolveBreakFree: gurpsResolveBreakFree,
  resolveGrappleTechnique: gurpsResolveGrappleTechnique,
};

const gurpsAdapter: ServerRulesetAdapter = {
   id: 'gurps',
   gridSystem: hexGrid,
   hasFacingArcs: true,
   advanceTurn: gurpsAdvanceTurn,
  initializeTurnMovement: gurpsInitializeTurnMovement,
  calculateReachableHexesInfo: gurpsCalculateReachableHexesInfo,
  gridToHex: gurpsGridToHex,
  hexToGrid: gurpsHexToGrid,
  executeMove: gurpsExecuteMove,
  executeRotation: gurpsExecuteRotation,
  calculateDerivedStats: gurpsCalculateDerivedStats,
  getPostureModifiers: gurpsGetPostureModifiers,
  calculateEncumbrance: gurpsCalculateEncumbrance,
  canChangePostureFree: gurpsCanChangePostureFree,
  
  combat: gurpsCombatDomain,
  damage: gurpsDamageDomain,
  closeCombat: gurpsCloseCombatDomain,
  pf2: undefined,
  
    resolveAttackRoll: gurpsResolveAttackRoll,
    resolveDefenseRoll: gurpsResolveDefenseRoll,
    calculateDefenseValue: gurpsCalculateDefenseValueWrapper,
    getDefenseOptions: gurpsGetDefenseOptionsWrapper,
    getRangePenalty: gurpsGetRangePenalty,
   canAttackAtDistance: gurpsCanAttackAtDistance,
   getCloseCombatAttackModifiers: gurpsGetCloseCombatAttackModifiers,
   getCloseCombatDefenseModifiers: gurpsGetCloseCombatDefenseModifiers,
   parseReach: gurpsParseReach,
   getHitLocationPenalty: gurpsGetHitLocationPenalty,
   rollCriticalHitTable: gurpsRollCriticalHitTable,
   rollCriticalMissTable: gurpsRollCriticalMissTable,
   applyCriticalHitDamage: gurpsApplyCriticalHitDamage,
   getCriticalMissDescription: gurpsGetCriticalMissDescription,
   rollDamage: gurpsRollDamage,
   applyDamageMultiplier: gurpsApplyDamageMultiplier,
   rollHTCheck: gurpsRollHTCheckWrapper,
   getHitLocationWoundingMultiplier: gurpsGetHitLocationWoundingMultiplier,
  quickContest: gurpsQuickContest,
  resolveGrappleAttempt: gurpsResolveGrappleAttempt,
  resolveBreakFree: gurpsResolveBreakFree,
  resolveGrappleTechnique: gurpsResolveGrappleTechnique,
};

const pf2Adapter: ServerRulesetAdapter = {
    id: 'pf2',
    gridSystem: squareGrid8,
    hasFacingArcs: false,
    advanceTurn: pf2AdvanceTurn,
    initializeTurnMovement: (position, facing, maneuver, basicMove) => {
     const movePoints = maneuver === 'pf2_step' ? 1 : basicMove;
     return pf2InitializeTurnMovement(position, facing, movePoints);
   },
  calculateReachableHexesInfo: pf2CalculateReachableHexesInfo,
  gridToHex: pf2GridToHex,
  hexToGrid: pf2HexToGrid,
  executeMove: pf2ExecuteMove,
  executeRotation: undefined,
  calculateDerivedStats: (attributes: Attributes): DerivedStats => {
    const st = attributes.strength;
    const dx = attributes.dexterity;
    const ht = attributes.health;
    const basicSpeed = (ht + dx) / 4;
    return {
      hitPoints: st,
      fatiguePoints: ht,
      basicSpeed,
      basicMove: Math.floor(basicSpeed),
      dodge: Math.floor(basicSpeed) + 3,
    };
  },
  getPostureModifiers: undefined,
  calculateEncumbrance: undefined,
  canChangePostureFree: undefined,
  
  combat: pf2CombatDomain,
  damage: pf2DamageDomain,
  closeCombat: undefined,
  pf2: {
    rollCheck: pf2RollCheck,
    rollDamage: (formula, damageType, random) => {
      const result = pf2RollDamage(formula, damageType as PF2DamageType, random);
      return { total: result.total, rolls: result.rolls, modifier: result.modifier };
    },
    getAbilityModifier: pf2GetAbilityModifier,
    getProficiencyBonus: (proficiency, level) => pf2GetProficiencyBonus(proficiency as PF2Proficiency, level),
    getMultipleAttackPenalty: pf2GetMultipleAttackPenalty,
  },
  
  resolveAttackRoll: pf2CombatDomain.resolveAttackRoll,
  resolveDefenseRoll: pf2CombatDomain.resolveDefenseRoll,
  calculateDefenseValue: pf2CombatDomain.calculateDefenseValue,
  getDefenseOptions: pf2CombatDomain.getDefenseOptions,
  getRangePenalty: pf2CombatDomain.getRangePenalty,
  canAttackAtDistance: pf2CombatDomain.canAttackAtDistance,
  getCloseCombatAttackModifiers: pf2CombatDomain.getCloseCombatAttackModifiers,
  getCloseCombatDefenseModifiers: pf2CombatDomain.getCloseCombatDefenseModifiers,
  parseReach: pf2CombatDomain.parseReach,
  getHitLocationPenalty: pf2CombatDomain.getHitLocationPenalty,
  rollCriticalHitTable: pf2CombatDomain.rollCriticalHitTable,
  rollCriticalMissTable: pf2CombatDomain.rollCriticalMissTable,
  applyCriticalHitDamage: pf2CombatDomain.applyCriticalHitDamage,
  getCriticalMissDescription: pf2CombatDomain.getCriticalMissDescription,
  rollDamage: pf2DamageDomain.rollDamage,
  applyDamageMultiplier: pf2DamageDomain.applyDamageMultiplier,
  rollHTCheck: pf2DamageDomain.rollHTCheck,
  getHitLocationWoundingMultiplier: pf2DamageDomain.getHitLocationWoundingMultiplier,
};

const adapters: Record<RulesetId, ServerRulesetAdapter> = {
  gurps: gurpsAdapter,
  pf2: pf2Adapter,
};

export const getServerAdapter = (rulesetId: RulesetId): ServerRulesetAdapter => {
  const adapter = adapters[rulesetId];
  if (!adapter) {
    throw new Error(`Unknown ruleset: ${rulesetId}`);
  }
  return adapter;
};

export const isGurpsMatch = (match: MatchState): boolean => {
  return match.rulesetId === 'gurps';
};

export const isPf2Match = (match: MatchState): boolean => {
  return match.rulesetId === 'pf2';
};

export function getGridType(rulesetId: RulesetId): 'hex' | 'square' {
  return getServerAdapter(rulesetId).gridSystem.type;
}
