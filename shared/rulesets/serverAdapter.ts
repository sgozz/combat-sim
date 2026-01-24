import type { MatchState, HexCoord, TurnMovementState, ReachableHexInfo, RulesetId, CharacterSheet } from '../types';
import type { ManeuverType, Posture, Equipment, Attributes, DerivedStats, Reach, ShieldSize, DamageType, HitLocation } from './gurps/types';
import type { GridSystem } from '../grid';
import { hexGrid } from '../grid';

export type MovementState = {
  position: HexCoord;
  facing: number;
  movePointsRemaining: number;
  freeRotationUsed: boolean;
  movedBackward: boolean;
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

export type CombatDomain = {
  resolveAttackRoll: (skill: number, random?: () => number) => GurpsAttackRollResult;
  resolveDefenseRoll: (defenseValue: number, random?: () => number) => GurpsDefenseRollResult;
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
  }) => number;
  getDefenseOptions: (character: CharacterSheet, dodgeValue: number) => GurpsDefenseOptions;
  getRangePenalty: (distance: number) => number;
  getPostureModifiers: (posture: Posture) => PostureModifiers;
  canAttackAtDistance: (reach: Reach, distance: number) => boolean;
  getCloseCombatAttackModifiers: (weapon: Equipment, distance: number) => GurpsCloseCombatAttackModifiers;
  getCloseCombatDefenseModifiers: (weaponReach: Reach | undefined, shieldSize: ShieldSize | undefined, inCloseCombat: boolean) => GurpsCloseCombatDefenseModifiers;
  parseReach: (reach: Reach) => { min: number; max: number; hasC: boolean };
  getHitLocationPenalty: (location: HitLocation) => number;
  rollCriticalHitTable?: (random?: () => number) => { roll: number; effect: GurpsCriticalHitEffect };
  rollCriticalMissTable?: (random?: () => number) => { roll: number; effect: GurpsCriticalMissEffect };
  applyCriticalHitDamage?: (baseDamage: number, effect: GurpsCriticalHitEffect, formula: string, random?: () => number) => { damage: number; description: string };
  getCriticalMissDescription?: (effect: GurpsCriticalMissEffect) => string;
};

export type DamageDomain = {
  rollDamage: (formula: string, random?: () => number) => GurpsDamageRoll;
  applyDamageMultiplier: (baseDamage: number, damageType: DamageType) => number;
  rollHTCheck: (ht: number, currentHP: number, maxHP: number, random?: () => number) => GurpsHTCheckResult;
  getHitLocationWoundingMultiplier: (location: HitLocation, damageType: DamageType) => number;
};

export type CloseCombatDomain = {
  quickContest: (attackerSkill: number, defenderSkill: number, random?: () => number) => GurpsQuickContestResult;
  resolveGrappleAttempt: (attackerDX: number, attackerSkill: number, defenderDX: number, canDefend: boolean, random?: () => number) => GurpsGrappleAttemptResult;
  resolveBreakFree: (defenderST: number, defenderSkill: number, controlPoints: number, random?: () => number) => GurpsBreakFreeResult;
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

export type PF2Domain = {
  rollCheck: (modifier: number, dc: number, random?: () => number) => PF2RollResultType;
  rollDamage: (formula: string, damageType: string, random?: () => number) => { total: number; rolls: number[]; modifier: number };
  getAbilityModifier: (score: number) => number;
  getProficiencyBonus: (proficiency: string, level: number) => number;
  getMultipleAttackPenalty: (attackNumber: number, isAgile: boolean) => number;
};

export type ServerRulesetAdapter = {
  id: RulesetId;
  gridSystem: GridSystem;
  advanceTurn: (state: MatchState) => MatchState;
  initializeTurnMovement: (
    position: HexCoord,
    facing: number,
    maneuver: ManeuverType | null,
    basicMove: number,
    posture: Posture
  ) => TurnMovementState;
  calculateReachableHexesInfo: (state: TurnMovementState, occupiedHexes: HexCoord[]) => ReachableHexInfo[];
  gridToHex: (pos: { x: number; z: number }) => HexCoord;
  hexToGrid: (hex: HexCoord) => { x: number; y: number; z: number };
  executeMove?: (state: MovementState, targetHex: HexCoord, occupiedHexes: HexCoord[]) => MovementState | null;
  executeRotation?: (state: MovementState, newFacing: number) => MovementState | null;
  calculateDerivedStats: (attributes: Attributes) => DerivedStats;
  getPostureModifiers?: (posture: Posture) => PostureModifiers;
  calculateEncumbrance?: (strength: number, equipment: Equipment[]) => EncumbranceInfo;
  canChangePostureFree?: (from: Posture, to: Posture) => boolean;
  
  combat?: CombatDomain;
  damage?: DamageDomain;
  closeCombat?: CloseCombatDomain;
  pf2?: PF2Domain;
  
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
  }) => number;
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

const gurpsCombatDomain: CombatDomain = {
  resolveAttackRoll: gurpsResolveAttackRoll,
  resolveDefenseRoll: gurpsResolveDefenseRoll,
  calculateDefenseValue: gurpsCalculateDefenseValue,
  getDefenseOptions: gurpsGetDefenseOptions,
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
};

const gurpsDamageDomain: DamageDomain = {
  rollDamage: gurpsRollDamage,
  applyDamageMultiplier: gurpsApplyDamageMultiplier,
  rollHTCheck: gurpsRollHTCheck,
  getHitLocationWoundingMultiplier: gurpsGetHitLocationWoundingMultiplier,
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
  calculateDefenseValue: gurpsCalculateDefenseValue,
  getDefenseOptions: gurpsGetDefenseOptions,
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
  rollHTCheck: gurpsRollHTCheck,
  getHitLocationWoundingMultiplier: gurpsGetHitLocationWoundingMultiplier,
  quickContest: gurpsQuickContest,
  resolveGrappleAttempt: gurpsResolveGrappleAttempt,
  resolveBreakFree: gurpsResolveBreakFree,
  resolveGrappleTechnique: gurpsResolveGrappleTechnique,
};

const pf2Adapter: ServerRulesetAdapter = {
  id: 'pf2',
  gridSystem: hexGrid,
  advanceTurn: pf2AdvanceTurn,
  initializeTurnMovement: (position, facing, _maneuver, basicMove, _posture) => {
    return pf2InitializeTurnMovement(position, facing, basicMove);
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
    console.warn(`Unknown ruleset: ${rulesetId}, falling back to GURPS`);
    return gurpsAdapter;
  }
  return adapter;
};

export const isGurpsMatch = (match: MatchState): boolean => {
  return match.rulesetId === 'gurps' || !match.rulesetId;
};

export const isPf2Match = (match: MatchState): boolean => {
  return match.rulesetId === 'pf2';
};
