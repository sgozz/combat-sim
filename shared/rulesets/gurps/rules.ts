// GURPS Combat Rules Implementation

import type { 
  Attributes, 
  DerivedStats, 
  DamageType, 
  Posture, 
  Reach, 
  Equipment, 
  ShieldSize, 
  CloseCombatPosition, 
  HitLocation,
  ManeuverType,
} from './types';
import type { MatchState, HexCoord, TurnMovementState, ReachableHexInfo } from '../../types';
import type { GurpsCharacterSheet } from './characterSheet';
import { isGurpsCombatant } from '../guards';

export type RollResult = {
  roll: number;
  dice: number[];
  target: number;
  margin: number;
  success: boolean;
  critical: boolean;
};

export type DamageRoll = {
  total: number;
  rolls: number[];
  modifier: number;
};

export type AttackResolution = {
  attack: RollResult;
  defense: RollResult | null;
  damage: DamageRoll | null;
  outcome: "miss" | "defended" | "hit" | "critical";
};

export type DefenseType = 'dodge' | 'parry' | 'block';

export type DefenseOptions = {
  dodge: number;
  parry: { value: number; weapon: string } | null;
  block: { value: number; shield: string } | null;
};

export type CriticalHitEffect = 
  | { type: 'triple_max_damage' }
  | { type: 'double_damage' }
  | { type: 'max_damage' }
  | { type: 'bonus_damage'; dice: number }
  | { type: 'normal' };

export type CriticalMissEffect =
  | { type: 'drop_weapon' }
  | { type: 'weapon_breaks' }
  | { type: 'lost_balance' }
  | { type: 'just_miss' }
  | { type: 'hit_self' };

export type HitLocationData = {
  penalty: number;
  damageMultiplier: number;
  woundingMultiplierTypes: DamageType[];
  cripplingThreshold: number | null;
};

export type PostureModifiers = {
  toHitMelee: number;
  toHitRanged: number;
  defenseVsMelee: number;
  defenseVsRanged: number;
  moveMultiplier: number;
};

export type PostureChangeInfo = {
  from: Posture;
  to: Posture;
  isFree: boolean;
  description: string;
};

export type EncumbranceLevel = 0 | 1 | 2 | 3 | 4;

export type EncumbranceInfo = {
  level: EncumbranceLevel;
  name: string;
  movePenalty: number;
  dodgePenalty: number;
  totalWeight: number;
  basicLift: number;
};

export type HTCheckResult = {
  roll: number;
  target: number;
  success: boolean;
  margin: number;
};

export type CloseCombatAttackModifiers = {
  toHit: number;
  canAttack: boolean;
  reason: string;
};

export type CloseCombatDefenseModifiers = {
  dodge: number;
  parry: number;
  block: number;
  retreatBonus: number;
  canParry: boolean;
  canBlock: boolean;
};

export type RetreatBonus = {
  dodge: number;
  parry: number;
  block: number;
};

export type AttackRollResult = {
  roll: RollResult;
  hit: boolean;
  critical: boolean;
  criticalMiss: boolean;
  autoDefenseFails: boolean;
};

export type DefenseRollResult = {
  roll: RollResult;
  defended: boolean;
  criticalSuccess: boolean;
  criticalFailure: boolean;
};

export type QuickContestResult = {
  attacker: RollResult;
  defender: RollResult;
  attackerWins: boolean;
  margin: number;
};

export type GrappleAttemptResult = {
  attack: RollResult;
  defense: RollResult | null;
  success: boolean;
  controlPoints: number;
};

export type BreakFreeResult = {
  roll: RollResult;
  success: boolean;
};

export type GrappleTechniqueResult = {
  roll: RollResult;
  success: boolean;
  damage?: DamageRoll;
  effect: string;
};

export type HexPosition = {
  q: number;
  r: number;
};

export type MovementState = {
  position: HexPosition;
  facing: number;
  movePointsRemaining: number;
  freeRotationUsed: boolean;
  movedBackward: boolean;
};

export type MovementCost = {
  total: number;
  rotationCost: number;
  movementCost: number;
  isBackward: boolean;
  path: HexPosition[];
};

export type ReachableHex = {
  position: HexPosition;
  cost: number;
  path: HexPosition[];
  finalFacing: number;
  requiresBackwardMove: boolean;
};

export const roll3d6 = (random: () => number = Math.random): { total: number; dice: number[] } => {
  const d1 = Math.floor(random() * 6) + 1;
  const d2 = Math.floor(random() * 6) + 1;
  const d3 = Math.floor(random() * 6) + 1;
  return { total: d1 + d2 + d3, dice: [d1, d2, d3] };
};

export const isCriticalSuccess = (roll: number, target: number): boolean => {
  if (roll <= 4) return true;
  if (roll === 5 && target >= 15) return true;
  if (roll === 6 && target >= 16) return true;
  return false;
};

export const isCriticalFailure = (roll: number, target: number): boolean => {
  if (roll === 18) return true;
  if (roll === 17 && target <= 15) return true;
  if (roll === 16 && target <= 6) return true;
  return false;
};

export const skillCheck = (target: number, random: () => number = Math.random): RollResult => {
  const { total: roll, dice } = roll3d6(random);
  const margin = target - roll;
  const critical = isCriticalSuccess(roll, target) || isCriticalFailure(roll, target);
  return {
    roll,
    dice,
    target,
    margin,
    success: margin >= 0 && !isCriticalFailure(roll, target),
    critical,
  };
};

export const rollDamage = (formula: string, random: () => number = Math.random): DamageRoll => {
  const match = formula.trim().match(/(\d+)d([+-]\d+)?/i);
  if (!match) {
    return { total: 0, rolls: [], modifier: 0 };
  }
  const diceCount = Number(match[1]);
  const modifier = Number(match[2] ?? 0);
  const rolls = Array.from({ length: diceCount }, () => Math.floor(random() * 6) + 1);
  const total = rolls.reduce((sum, value) => sum + value, 0) + modifier;
  return { total, rolls, modifier };
};

export const calculateDerivedStats = (attributes: Attributes): DerivedStats => {
  const hitPoints = attributes.strength;
  const fatiguePoints = attributes.health;
  const basicSpeed = (attributes.dexterity + attributes.health) / 4;
  const basicMove = Math.floor(basicSpeed);
  const dodge = Math.floor(basicSpeed) + 3;
  return { hitPoints, fatiguePoints, basicSpeed, basicMove, dodge };
};

export const calculateAttributeCost = (attributes: Attributes): number => {
  const stCost = (attributes.strength - 10) * 10;
  const dxCost = (attributes.dexterity - 10) * 20;
  const iqCost = (attributes.intelligence - 10) * 20;
  const htCost = (attributes.health - 10) * 10;
  return stCost + dxCost + iqCost + htCost;
};

export const calculateSkillCost = (skillLevel: number, attributeLevel: number, difficulty: 'E' | 'A' | 'H' | 'VH' = 'A'): number => {
  const relative = skillLevel - attributeLevel;
  const difficultyOffset = { 'E': 0, 'A': -1, 'H': -2, 'VH': -3 }[difficulty];
  const effectiveRelative = relative + difficultyOffset;
  
  if (effectiveRelative < 0) return 1;
  if (effectiveRelative === 0) return 1;
  if (effectiveRelative === 1) return 2;
  if (effectiveRelative === 2) return 4;
  return 4 + (effectiveRelative - 2) * 4;
};

export const calculateTotalPoints = (character: GurpsCharacterSheet): number => {
  const attrCost = calculateAttributeCost(character.attributes);
  const skillCost = character.skills.reduce((sum, skill) => {
    return sum + calculateSkillCost(skill.level, character.attributes.dexterity);
  }, 0);
  return attrCost + skillCost;
};

export const calculateParry = (skillLevel: number, weaponParryMod: number = 0): number => {
  return Math.floor(skillLevel / 2) + 3 + weaponParryMod;
};

export const calculateBlock = (shieldSkill: number, shieldBlockMod: number = 0): number => {
  return Math.floor(shieldSkill / 2) + 3 + shieldBlockMod;
};

export const getDefenseOptions = (
  character: GurpsCharacterSheet,
  dodgeValue: number
): DefenseOptions => {
  const result: DefenseOptions = {
    dodge: dodgeValue,
    parry: null,
    block: null,
  };
  
  const meleeWeapon = character.equipment.find(e => e.type === 'melee' && e.parry !== undefined);
  if (meleeWeapon) {
    const weaponSkill = character.skills.find(s => s.name === meleeWeapon.skillUsed);
    if (weaponSkill) {
      result.parry = {
        value: calculateParry(weaponSkill.level, meleeWeapon.parry ?? 0),
        weapon: meleeWeapon.name,
      };
    }
  }
  
  const shield = character.equipment.find(e => e.type === 'shield');
  if (shield) {
    const shieldSkill = character.skills.find(s => s.name === 'Shield');
    if (shieldSkill) {
      result.block = {
        value: calculateBlock(shieldSkill.level, shield.block ?? 0),
        shield: shield.name,
      };
    }
  }
  
  return result;
};

export const getRetreatBonus = (inCloseCombat: boolean): RetreatBonus => {
  if (inCloseCombat) {
    return { dodge: 1, parry: 1, block: 1 };
  }
  return { dodge: 3, parry: 1, block: 1 };
};

export const calculateDefenseValue = (
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
  }
): number => {
  let value = baseDefense;
  
  if (options.retreat) {
    const bonus = getRetreatBonus(options.inCloseCombat);
    value += bonus[options.defenseType];
  }
  
  if (options.dodgeAndDrop && options.defenseType === 'dodge') {
    value += 3;
  }
  
  if (options.defensesThisTurn > 0) {
    if (options.sameWeaponParry && options.defenseType === 'parry') {
      value -= 4;
      if (options.defensesThisTurn > 1) {
        value -= (options.defensesThisTurn - 1);
      }
    } else {
      value -= options.defensesThisTurn;
    }
  }
  
  value -= options.deceptivePenalty;
  
  if (options.feintPenalty) {
    value -= options.feintPenalty;
  }
  
  value += options.postureModifier;
  
  if (options.lostBalance) {
    value -= 2;
  }
  
  return Math.max(3, value);
};

export const resolveDefenseRoll = (
  defenseValue: number,
  random: () => number = Math.random
): DefenseRollResult => {
  const roll = skillCheck(defenseValue, random);
  const criticalFailure = isCriticalFailure(roll.roll, roll.target);
  const criticalSuccess = isCriticalSuccess(roll.roll, roll.target);
  return {
    roll,
    defended: roll.success && !criticalFailure,
    criticalSuccess,
    criticalFailure,
  };
};

export const getRangePenalty = (distance: number): number => {
  if (distance <= 2) return 0;
  if (distance <= 3) return -1;
  if (distance <= 5) return -2;
  if (distance <= 7) return -3;
  if (distance <= 10) return -4;
  if (distance <= 15) return -5;
  if (distance <= 20) return -6;
  if (distance <= 30) return -7;
  if (distance <= 50) return -8;
  if (distance <= 70) return -9;
  if (distance <= 100) return -10;
  return -11;
};

export const resolveAttackRoll = (
  skill: number,
  random: () => number = Math.random
): AttackRollResult => {
  const roll = skillCheck(skill, random);
  const critical = roll.critical && roll.success;
  const criticalMiss = isCriticalFailure(roll.roll, roll.target);
  return {
    roll,
    hit: roll.success,
    critical,
    criticalMiss,
    autoDefenseFails: critical,
  };
};

export const resolveAttack = (options: {
  skill: number;
  defense?: number;
  damage: string;
  random?: () => number;
}): AttackResolution => {
  const random = options.random ?? Math.random;
  const attack = skillCheck(options.skill, random);

  if (!attack.success) {
    return { attack, defense: null, damage: null, outcome: "miss" };
  }

  if (attack.critical && attack.margin >= 0) {
    const damage = rollDamage(options.damage, random);
    return { attack, defense: null, damage, outcome: "critical" };
  }

  if (!options.defense) {
    const damage = rollDamage(options.damage, random);
    return { attack, defense: null, damage, outcome: "hit" };
  }

  const defense = skillCheck(options.defense, random);
  if (defense.success && !isCriticalFailure(defense.roll, defense.target)) {
    return { attack, defense, damage: null, outcome: "defended" };
  }

  const damage = rollDamage(options.damage, random);
  return { attack, defense, damage, outcome: "hit" };
};

export const rollCriticalHitTable = (random: () => number = Math.random): { roll: number; effect: CriticalHitEffect } => {
  const { total: roll } = roll3d6(random);
  
  let effect: CriticalHitEffect;
  if (roll === 3) {
    effect = { type: 'triple_max_damage' };
  } else if (roll <= 5) {
    effect = { type: 'double_damage' };
  } else if (roll === 6) {
    effect = { type: 'max_damage' };
  } else if (roll === 7) {
    effect = { type: 'bonus_damage', dice: 1 };
  } else {
    effect = { type: 'normal' };
  }
  
  return { roll, effect };
};

export const rollCriticalMissTable = (random: () => number = Math.random): { roll: number; effect: CriticalMissEffect } => {
  const { total: roll } = roll3d6(random);
  
  let effect: CriticalMissEffect;
  if (roll <= 4) {
    effect = { type: 'drop_weapon' };
  } else if (roll <= 6) {
    effect = { type: 'weapon_breaks' };
  } else if (roll <= 8) {
    effect = { type: 'lost_balance' };
  } else if (roll <= 13) {
    effect = { type: 'just_miss' };
  } else if (roll === 14) {
    effect = { type: 'lost_balance' };
  } else if (roll <= 16) {
    effect = { type: 'drop_weapon' };
  } else {
    effect = { type: 'hit_self' };
  }
  
  return { roll, effect };
};

export const applyCriticalHitDamage = (
  baseDamage: number,
  effect: CriticalHitEffect,
  formula: string,
  random: () => number = Math.random
): { damage: number; description: string } => {
  const match = formula.trim().match(/(\d+)d([+-]\d+)?/i);
  const diceCount = match ? Number(match[1]) : 1;
  const modifier = match ? Number(match[2] ?? 0) : 0;
  const maxRoll = diceCount * 6 + modifier;
  
  switch (effect.type) {
    case 'triple_max_damage':
      return { damage: maxRoll * 3, description: 'Triple maximum damage!' };
    case 'double_damage':
      return { damage: baseDamage * 2, description: 'Double damage!' };
    case 'max_damage':
      return { damage: maxRoll, description: 'Maximum damage!' };
    case 'bonus_damage': {
      const bonusDmg = rollDamage(`${effect.dice}d`, random);
      return { damage: baseDamage + bonusDmg.total, description: `+${bonusDmg.total} bonus damage!` };
    }
    case 'normal':
      return { damage: baseDamage, description: '' };
  }
};

export const getCriticalMissDescription = (effect: CriticalMissEffect): string => {
  switch (effect.type) {
    case 'drop_weapon':
      return 'Weapon dropped!';
    case 'weapon_breaks':
      return 'Weapon breaks!';
    case 'lost_balance':
      return 'Lost balance! -2 to defenses until next turn.';
    case 'just_miss':
      return '';
    case 'hit_self':
      return 'Hit self!';
  }
};

export const getDamageMultiplier = (damageType: DamageType): number => {
  switch (damageType) {
    case 'cutting':
      return 1.5;
    case 'impaling':
      return 2;
    case 'crushing':
    case 'piercing':
    default:
      return 1;
  }
};

export const applyDamageMultiplier = (
  baseDamage: number,
  damageType: DamageType = 'crushing'
): number => {
  const multiplier = getDamageMultiplier(damageType);
  return Math.floor(baseDamage * multiplier);
};

export const HIT_LOCATION_DATA: Record<HitLocation, HitLocationData> = {
  eye:        { penalty: -9, damageMultiplier: 4, woundingMultiplierTypes: ['impaling', 'piercing'], cripplingThreshold: null },
  skull:      { penalty: -7, damageMultiplier: 4, woundingMultiplierTypes: ['crushing', 'cutting', 'impaling', 'piercing'], cripplingThreshold: null },
  face:       { penalty: -5, damageMultiplier: 1, woundingMultiplierTypes: [], cripplingThreshold: null },
  neck:       { penalty: -5, damageMultiplier: 2, woundingMultiplierTypes: ['cutting'], cripplingThreshold: null },
  torso:      { penalty: 0,  damageMultiplier: 1, woundingMultiplierTypes: [], cripplingThreshold: null },
  vitals:     { penalty: -3, damageMultiplier: 3, woundingMultiplierTypes: ['impaling', 'piercing'], cripplingThreshold: null },
  groin:      { penalty: -3, damageMultiplier: 1, woundingMultiplierTypes: [], cripplingThreshold: null },
  arm_right:  { penalty: -2, damageMultiplier: 1, woundingMultiplierTypes: [], cripplingThreshold: 0.5 },
  arm_left:   { penalty: -2, damageMultiplier: 1, woundingMultiplierTypes: [], cripplingThreshold: 0.5 },
  hand_right: { penalty: -4, damageMultiplier: 1, woundingMultiplierTypes: [], cripplingThreshold: 0.33 },
  hand_left:  { penalty: -4, damageMultiplier: 1, woundingMultiplierTypes: [], cripplingThreshold: 0.33 },
  leg_right:  { penalty: -2, damageMultiplier: 1, woundingMultiplierTypes: [], cripplingThreshold: 0.5 },
  leg_left:   { penalty: -2, damageMultiplier: 1, woundingMultiplierTypes: [], cripplingThreshold: 0.5 },
  foot_right: { penalty: -4, damageMultiplier: 1, woundingMultiplierTypes: [], cripplingThreshold: 0.33 },
  foot_left:  { penalty: -4, damageMultiplier: 1, woundingMultiplierTypes: [], cripplingThreshold: 0.33 },
};

export const getHitLocationPenalty = (location: HitLocation): number => {
  return HIT_LOCATION_DATA[location].penalty;
};

export const getHitLocationWoundingMultiplier = (
  location: HitLocation,
  damageType: DamageType
): number => {
  const data = HIT_LOCATION_DATA[location];
  if (data.woundingMultiplierTypes.includes(damageType)) {
    return data.damageMultiplier;
  }
  if (location === 'skull' || location === 'eye') {
    return data.damageMultiplier;
  }
  return 1;
};

export const rollRandomHitLocation = (random: () => number = Math.random): HitLocation => {
  const { total } = roll3d6(random);
  if (total === 3 || total === 4) return 'skull';
  if (total === 5) return 'face';
  if (total === 6 || total === 7) return 'leg_right';
  if (total === 8) return 'arm_right';
  if (total >= 9 && total <= 11) return 'torso';
  if (total === 12) return 'groin';
  if (total === 13) return 'arm_left';
  if (total === 14 || total === 15) return 'leg_left';
  if (total === 16) return 'hand_left';
  if (total === 17 || total === 18) return 'foot_left';
  return 'torso';
};

export const getLocationDR = (character: GurpsCharacterSheet, hitLocation: HitLocation): number => {
  const armorPieces = character.equipment.filter(e => e.type === 'armor' && e.dr && e.coveredLocations);
  const coveringArmor = armorPieces.filter(armor => armor.coveredLocations?.includes(hitLocation));
  
  if (coveringArmor.length === 0) {
    return 0;
  }
  
  return Math.max(...coveringArmor.map(armor => armor.dr ?? 0));
};

export const getPostureModifiers = (posture: Posture): PostureModifiers => {
  switch (posture) {
    case 'crouching':
      return { toHitMelee: 0, toHitRanged: 0, defenseVsMelee: -2, defenseVsRanged: 2, moveMultiplier: 2/3 };
    case 'kneeling':
      return { toHitMelee: -2, toHitRanged: 0, defenseVsMelee: -2, defenseVsRanged: 2, moveMultiplier: 1/3 };
    case 'prone':
      return { toHitMelee: -4, toHitRanged: -2, defenseVsMelee: -3, defenseVsRanged: 4, moveMultiplier: 0 };
    case 'standing':
    default:
      return { toHitMelee: 0, toHitRanged: 0, defenseVsMelee: 0, defenseVsRanged: 0, moveMultiplier: 1 };
  }
};

const POSTURE_ORDER: Posture[] = ['standing', 'crouching', 'kneeling', 'prone'];

export const canChangePostureFree = (from: Posture, to: Posture): boolean => {
  if (from === to) return true;
  
  const fromIndex = POSTURE_ORDER.indexOf(from);
  const toIndex = POSTURE_ORDER.indexOf(to);
  
  if ((from === 'standing' && to === 'crouching') || 
      (from === 'crouching' && to === 'standing')) {
    return true;
  }
  
  if (toIndex === fromIndex + 1) {
    return true;
  }
  
  return false;
};

export const getValidPostureChanges = (current: Posture): PostureChangeInfo[] => {
  const postures: Posture[] = ['standing', 'crouching', 'kneeling', 'prone'];
  
  return postures
    .filter(p => p !== current)
    .map(to => ({
      from: current,
      to,
      isFree: canChangePostureFree(current, to),
      description: canChangePostureFree(current, to) 
        ? 'Free (step)' 
        : 'Requires Change Posture'
    }));
};

export const calculateBasicLift = (strength: number): number => {
  return (strength * strength) / 5;
};

export const calculateEncumbrance = (
  strength: number,
  equipment: Equipment[]
): EncumbranceInfo => {
  const basicLift = calculateBasicLift(strength);
  const totalWeight = equipment.reduce((sum, e) => sum + (e.weight ?? 0), 0);
  
  const thresholds = [
    { max: basicLift, level: 0 as EncumbranceLevel, name: 'None', move: 0, dodge: 0 },
    { max: basicLift * 2, level: 1 as EncumbranceLevel, name: 'Light', move: -1, dodge: -1 },
    { max: basicLift * 3, level: 2 as EncumbranceLevel, name: 'Medium', move: -2, dodge: -2 },
    { max: basicLift * 6, level: 3 as EncumbranceLevel, name: 'Heavy', move: -3, dodge: -3 },
    { max: basicLift * 10, level: 4 as EncumbranceLevel, name: 'Extra-Heavy', move: -4, dodge: -4 },
  ];
  
  for (const t of thresholds) {
    if (totalWeight <= t.max) {
      return {
        level: t.level,
        name: t.name,
        movePenalty: t.move,
        dodgePenalty: t.dodge,
        totalWeight,
        basicLift,
      };
    }
  }
  
  return {
    level: 4,
    name: 'Extra-Heavy',
    movePenalty: -4,
    dodgePenalty: -4,
    totalWeight,
    basicLift,
  };
};

export const rollHTCheck = (
  ht: number, 
  currentHP: number, 
  maxHP: number, 
  random: () => number = Math.random
): HTCheckResult => {
  const { total: roll } = roll3d6(random);
  const hpMultiple = Math.floor(Math.abs(currentHP) / maxHP);
  const penalty = hpMultiple > 0 ? hpMultiple : 0;
  const target = ht - penalty;
  const margin = target - roll;
  return { roll, target, success: margin >= 0, margin };
};

export const advanceTurn = (state: MatchState): MatchState => {
  if (state.players.length === 0) {
    return state;
  }
  const currentIndex = state.players.findIndex((player) => player.id === state.activeTurnPlayerId);
  const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % state.players.length;
  const round = nextIndex === 0 ? state.round + 1 : state.round;
  const nextPlayerId = state.players[nextIndex]?.id ?? "";

  const combatants = state.combatants.map(c => {
     if (!isGurpsCombatant(c)) return c;
     if (c.playerId === nextPlayerId) {
       const cleanedEffects = c.statusEffects.filter(e => e !== 'defending' && e !== 'has_stepped' && e !== 'lost_balance' && e !== 'stunned');
       return { ...c, maneuver: null, aoaVariant: null, aodVariant: null, statusEffects: cleanedEffects, usedReaction: false, shockPenalty: 0, attacksRemaining: 1, retreatedThisTurn: false, defensesThisTurn: 0, parryWeaponsUsedThisTurn: [], waitTrigger: null };
     }
     if (c.playerId === state.activeTurnPlayerId) {
       const didAttack = c.maneuver === 'attack' || c.maneuver === 'all_out_attack' || c.maneuver === 'move_and_attack';
       if (didAttack) {
         return { ...c, evaluateBonus: 0, evaluateTargetId: null };
       }
     }
     return c;
   });

  return {
    ...state,
    combatants,
    activeTurnPlayerId: nextPlayerId,
    round,
    turnMovement: undefined,
    reachableHexes: undefined,
  };
};

export const parseReach = (reach: Reach): { min: number; max: number; hasC: boolean } => {
  if (reach === 'C') return { min: 0, max: 0, hasC: true };
  if (reach === '1') return { min: 1, max: 1, hasC: false };
  if (reach === '2') return { min: 2, max: 2, hasC: false };
  if (reach === '3') return { min: 3, max: 3, hasC: false };
  if (reach === 'C,1') return { min: 0, max: 1, hasC: true };
  if (reach === '1,2') return { min: 1, max: 2, hasC: false };
  if (reach === '2,3') return { min: 2, max: 3, hasC: false };
  return { min: 1, max: 1, hasC: false };
};

export const canAttackAtDistance = (reach: Reach, distance: number): boolean => {
  const { min, max, hasC } = parseReach(reach);
  if (distance === 0) return hasC || min <= 1;
  return distance >= min && distance <= max;
};

export const getCloseCombatAttackModifiers = (
  weapon: Equipment,
  distance: number
): CloseCombatAttackModifiers => {
  if (distance !== 0) {
    return { toHit: 0, canAttack: true, reason: 'normal range' };
  }
  
  const reach = weapon.reach ?? '1';
  const { hasC, min } = parseReach(reach);
  
  if (hasC) {
    return { toHit: 0, canAttack: true, reason: 'close combat weapon' };
  }
  
  if (min === 1) {
    return { toHit: -2, canAttack: true, reason: 'Reach 1 weapon in close combat (-2)' };
  }
  
  return { toHit: 0, canAttack: false, reason: `Reach ${reach} cannot be used in close combat` };
};

export const getCloseCombatDefenseModifiers = (
  weaponReach: Reach | undefined,
  shieldSize: ShieldSize | undefined,
  inCloseCombat: boolean
): CloseCombatDefenseModifiers => {
  if (!inCloseCombat) {
    return { dodge: 0, parry: 0, block: 0, retreatBonus: 3, canParry: true, canBlock: true };
  }
  
  const reach = weaponReach ?? '1';
  const { hasC, min } = parseReach(reach);
  
  let parryMod = 0;
  let canParry = true;
  
  if (hasC) {
    parryMod = 0;
  } else if (min === 1) {
    parryMod = -2;
  } else {
    canParry = false;
  }
  
  let blockMod = 0;
  const canBlock = true;
  if (shieldSize === 'medium' || shieldSize === 'large') {
    blockMod = -2;
  }
  
  return {
    dodge: 0,
    parry: parryMod,
    block: blockMod,
    retreatBonus: 1,
    canParry,
    canBlock,
  };
};

export const getCloseCombatPositionModifier = (position: CloseCombatPosition | null): number => {
  if (position === 'side') return -2;
  if (position === 'back') return -4;
  return 0;
};

export const canDefendFromPosition = (position: CloseCombatPosition | null): boolean => {
  return position !== 'back';
};

export const quickContest = (
  attackerSkill: number,
  defenderSkill: number,
  random: () => number = Math.random
): QuickContestResult => {
  const attacker = skillCheck(attackerSkill, random);
  const defender = skillCheck(defenderSkill, random);
  
  const attackerMargin = attacker.margin;
  const defenderMargin = defender.margin;
  
  let attackerWins: boolean;
  let margin: number;
  
  if (attacker.success && !defender.success) {
    attackerWins = true;
    margin = attackerMargin - defenderMargin;
  } else if (!attacker.success && defender.success) {
    attackerWins = false;
    margin = defenderMargin - attackerMargin;
  } else {
    margin = attackerMargin - defenderMargin;
    attackerWins = margin > 0;
  }
  
  return { attacker, defender, attackerWins, margin };
};

export const resolveGrappleAttempt = (
  attackerDX: number,
  attackerSkill: number,
  defenderDX: number,
  canDefend: boolean,
  random: () => number = Math.random
): GrappleAttemptResult => {
  const effectiveSkill = Math.max(attackerDX, attackerSkill);
  const attack = skillCheck(effectiveSkill, random);
  
  if (!attack.success) {
    return { attack, defense: null, success: false, controlPoints: 0 };
  }
  
  if (!canDefend) {
    const cp = Math.max(0, attack.margin);
    return { attack, defense: null, success: true, controlPoints: cp };
  }
  
  const defense = skillCheck(defenderDX, random);
  if (defense.success) {
    return { attack, defense, success: false, controlPoints: 0 };
  }
  
  const cp = Math.max(0, attack.margin);
  return { attack, defense, success: true, controlPoints: cp };
};

export const resolveBreakFree = (
  defenderST: number,
  defenderSkill: number,
  controlPoints: number,
  random: () => number = Math.random
): BreakFreeResult => {
  const effectiveSkill = Math.max(defenderST, defenderSkill) - controlPoints;
  const roll = skillCheck(effectiveSkill, random);
  return { roll, success: roll.success };
};

export const resolveGrappleTechnique = (
  technique: 'throw' | 'lock' | 'choke' | 'pin',
  skill: number,
  ST: number,
  controlPoints: number,
  random: () => number = Math.random
): GrappleTechniqueResult => {
  const cpBonus = Math.floor(controlPoints / 2);
  const effectiveSkill = skill + cpBonus;
  const roll = skillCheck(effectiveSkill, random);
  
  if (!roll.success) {
    return { roll, success: false, effect: 'failed' };
  }
  
  switch (technique) {
    case 'throw': {
      const damage = rollDamage(`${Math.ceil(ST / 2)}d`, random);
      return { roll, success: true, damage, effect: 'thrown to ground, stunned' };
    }
    case 'lock': {
      const damage = rollDamage('1d-1', random);
      return { roll, success: true, damage, effect: 'arm/leg locked, ongoing pain' };
    }
    case 'choke': {
      return { roll, success: true, effect: 'choking, lose 1 FP per second' };
    }
    case 'pin': {
      return { roll, success: true, effect: 'pinned, cannot act' };
    }
  }
};

const HEX_DIRECTIONS: HexPosition[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

export const getHexNeighbor = (pos: HexPosition, direction: number): HexPosition => {
  const dir = HEX_DIRECTIONS[(direction % 6 + 6) % 6];
  return { q: pos.q + dir.q, r: pos.r + dir.r };
};

export const hexDistance = (a: HexPosition, b: HexPosition): number => {
  return (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2;
};

export const getDirectionToHex = (from: HexPosition, to: HexPosition): number | null => {
  const dq = to.q - from.q;
  const dr = to.r - from.r;
  
  for (let i = 0; i < 6; i++) {
    if (HEX_DIRECTIONS[i].q === dq && HEX_DIRECTIONS[i].r === dr) {
      return i;
    }
  }
  return null;
};

export const getRelativeDirection = (facing: number, moveDirection: number): 'front' | 'front-side' | 'rear-side' | 'rear' => {
  const diff = ((moveDirection - facing) % 6 + 6) % 6;
  if (diff === 0) return 'front';
  if (diff === 1 || diff === 5) return 'front-side';
  if (diff === 2 || diff === 4) return 'rear-side';
  return 'rear';
};

export const getRotationCost = (fromFacing: number, toFacing: number, freeRotationUsed: boolean): number => {
  let diff = ((toFacing - fromFacing) % 6 + 6) % 6;
  if (diff > 3) diff = 6 - diff;
  
  if (diff === 0) return 0;
  if (!freeRotationUsed) return Math.max(0, diff - 1);
  return diff;
};

export const getMovementCostToAdjacent = (
  from: HexPosition,
  to: HexPosition,
  facing: number
): { cost: number; isBackward: boolean } => {
  const direction = getDirectionToHex(from, to);
  if (direction === null) return { cost: Infinity, isBackward: false };
  
  const relDir = getRelativeDirection(facing, direction);
  
  if (relDir === 'rear') {
    return { cost: 2, isBackward: true };
  }
  return { cost: 1, isBackward: false };
};

type DijkstraState = {
  position: HexPosition;
  facing: number;
  cost: number;
  path: HexPosition[];
  freeRotationUsed: boolean;
  movedBackward: boolean;
};

export const getReachableHexes = (
  startPos: HexPosition,
  startFacing: number,
  basicMove: number,
  freeRotationUsed: boolean = false,
  occupiedHexes: HexPosition[] = []
): Map<string, ReachableHex> => {
  const results = new Map<string, ReachableHex>();
  const visited = new Map<string, number>();
  const queue: DijkstraState[] = [];
  
  const posKey = (p: HexPosition, f: number) => `${p.q},${p.r},${f}`;
  const hexKey = (p: HexPosition) => `${p.q},${p.r}`;
  const isOccupied = (p: HexPosition) => occupiedHexes.some(o => o.q === p.q && o.r === p.r);
  
  queue.push({
    position: startPos,
    facing: startFacing,
    cost: 0,
    path: [startPos],
    freeRotationUsed,
    movedBackward: false,
  });
  
  while (queue.length > 0) {
    queue.sort((a, b) => a.cost - b.cost);
    const current = queue.shift()!;
    
    const key = posKey(current.position, current.facing);
    if (visited.has(key) && visited.get(key)! <= current.cost) continue;
    visited.set(key, current.cost);
    
    const hKey = hexKey(current.position);
    if (!results.has(hKey) || results.get(hKey)!.cost > current.cost) {
      results.set(hKey, {
        position: current.position,
        cost: current.cost,
        path: current.path,
        finalFacing: current.facing,
        requiresBackwardMove: current.movedBackward,
      });
    }
    
    if (current.cost >= basicMove) continue;
    
    for (let newFacing = 0; newFacing < 6; newFacing++) {
      if (newFacing !== current.facing) {
        const rotCost = getRotationCost(current.facing, newFacing, current.freeRotationUsed);
        const newCost = current.cost + rotCost;
        
        if (newCost <= basicMove) {
          queue.push({
            position: current.position,
            facing: newFacing,
            cost: newCost,
            path: current.path,
            freeRotationUsed: current.freeRotationUsed || rotCost < ((newFacing - current.facing + 6) % 6 > 3 ? 6 - ((newFacing - current.facing + 6) % 6) : (newFacing - current.facing + 6) % 6),
            movedBackward: current.movedBackward,
          });
        }
      }
    }
    
    for (let dir = 0; dir < 6; dir++) {
      const neighbor = getHexNeighbor(current.position, dir);
      
      if (isOccupied(neighbor)) continue;
      
      const { cost: moveCost, isBackward } = getMovementCostToAdjacent(
        current.position,
        neighbor,
        current.facing
      );
      
      if (moveCost === Infinity) continue;
      
      const newCost = current.cost + moveCost;
      if (newCost > basicMove) continue;
      
      queue.push({
        position: neighbor,
        facing: current.facing,
        cost: newCost,
        path: [...current.path, neighbor],
        freeRotationUsed: current.freeRotationUsed,
        movedBackward: current.movedBackward || isBackward,
      });
    }
  }
  
  results.delete(hexKey(startPos));
  
  return results;
};

export const calculateMovementCost = (
  from: HexPosition,
  to: HexPosition,
  fromFacing: number,
  basicMove: number,
  freeRotationUsed: boolean = false,
  occupiedHexes: HexPosition[] = []
): MovementCost | null => {
  const reachable = getReachableHexes(from, fromFacing, basicMove, freeRotationUsed, occupiedHexes);
  const key = `${to.q},${to.r}`;
  
  const result = reachable.get(key);
  if (!result) return null;
  
  return {
    total: result.cost,
    rotationCost: 0,
    movementCost: result.cost,
    isBackward: result.requiresBackwardMove,
    path: result.path,
  };
};

export const canMoveTo = (
  from: HexPosition,
  to: HexPosition,
  fromFacing: number,
  movePointsRemaining: number,
  freeRotationUsed: boolean = false,
  occupiedHexes: HexPosition[] = []
): boolean => {
  const cost = calculateMovementCost(from, to, fromFacing, movePointsRemaining, freeRotationUsed, occupiedHexes);
  return cost !== null && cost.total <= movePointsRemaining;
};

export const executeMove = (
  state: MovementState,
  to: HexPosition,
  occupiedHexes: HexPosition[] = []
): MovementState | null => {
  const cost = calculateMovementCost(
    state.position,
    to,
    state.facing,
    state.movePointsRemaining,
    state.freeRotationUsed,
    occupiedHexes
  );
  
  if (!cost || cost.total > state.movePointsRemaining) return null;
  
  const reachable = getReachableHexes(
    state.position,
    state.facing,
    state.movePointsRemaining,
    state.freeRotationUsed,
    occupiedHexes
  );
  const result = reachable.get(`${to.q},${to.r}`);
  if (!result) return null;
  
  return {
    position: to,
    facing: result.finalFacing,
    movePointsRemaining: state.movePointsRemaining - cost.total,
    freeRotationUsed: true,
    movedBackward: state.movedBackward || cost.isBackward,
  };
};

export const executeRotation = (
  state: MovementState,
  newFacing: number
): MovementState | null => {
  const cost = getRotationCost(state.facing, newFacing, state.freeRotationUsed);
  
  if (cost > state.movePointsRemaining) return null;
  
  return {
    ...state,
    facing: newFacing,
    movePointsRemaining: state.movePointsRemaining - cost,
    freeRotationUsed: state.freeRotationUsed || cost === 0,
  };
};

export const getMovePointsForManeuver = (
  maneuver: ManeuverType | null,
  basicMove: number,
  posture: Posture
): number => {
  const postureMods = getPostureModifiers(posture);
  const baseMove = Math.floor(basicMove * postureMods.moveMultiplier);
  
  switch (maneuver) {
    case 'do_nothing':
      return 0;
    case 'move':
      return baseMove;
    case 'all_out_defense':
      return Math.min(baseMove, 1);
    case 'attack':
    case 'aim':
    case 'concentrate':
      return 1;
    case 'all_out_attack':
      return Math.floor(basicMove / 2);
    case 'move_and_attack':
      return baseMove;
    default:
      return 0;
  }
};

export const initializeTurnMovement = (
  position: HexCoord,
  facing: number,
  maneuver: ManeuverType | null,
  basicMove: number,
  posture: Posture
): TurnMovementState => {
  const movePoints = getMovePointsForManeuver(maneuver, basicMove, posture);
  
  return {
    startPosition: { ...position },
    startFacing: facing,
    currentPosition: { ...position },
    currentFacing: facing,
    movePointsRemaining: movePoints,
    freeRotationUsed: false,
    movedBackward: false,
    phase: movePoints > 0 ? 'moving' : 'completed',
  };
};

export const calculateReachableHexesInfo = (
  state: TurnMovementState,
  occupiedHexes: HexCoord[]
): ReachableHexInfo[] => {
  const reachable = getReachableHexes(
    state.currentPosition,
    state.currentFacing,
    state.movePointsRemaining,
    state.freeRotationUsed,
    occupiedHexes
  );
  
  const result: ReachableHexInfo[] = [];
  reachable.forEach((hex) => {
    result.push({
      q: hex.position.q,
      r: hex.position.r,
      cost: hex.cost,
      finalFacing: hex.finalFacing,
    });
  });
  
  return result;
};

export const gridToHex = (pos: { x: number; z: number }): HexCoord => ({
  q: pos.x,
  r: pos.z,
});

export const hexToGrid = (hex: HexCoord): { x: number; y: number; z: number } => ({
  x: hex.q,
  y: 0,
  z: hex.r,
});
