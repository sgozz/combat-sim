import type { Attributes, DerivedStats, MatchState, CharacterSheet, DamageType, Posture } from "./types";

export type RollResult = {
  roll: number;
  dice: number[];
  target: number;
  margin: number;
  success: boolean;
  critical: boolean;
};

// ...

export const roll3d6 = (random: () => number = Math.random): { total: number; dice: number[] } => {
  const d1 = Math.floor(random() * 6) + 1;
  const d2 = Math.floor(random() * 6) + 1;
  const d3 = Math.floor(random() * 6) + 1;
  return { total: d1 + d2 + d3, dice: [d1, d2, d3] };
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

export const calculateTotalPoints = (character: CharacterSheet): number => {
  const attrCost = calculateAttributeCost(character.attributes);
  const skillCost = character.skills.reduce((sum, skill) => {
    return sum + calculateSkillCost(skill.level, character.attributes.dexterity);
  }, 0);
  return attrCost + skillCost;
};

export type DefenseType = 'dodge' | 'parry' | 'block';

export type DefenseOptions = {
  dodge: number;
  parry: { value: number; weapon: string } | null;
  block: { value: number; shield: string } | null;
};

export const calculateParry = (skillLevel: number, weaponParryMod: number = 0): number => {
  return Math.floor(skillLevel / 2) + 3 + weaponParryMod;
};

export const calculateBlock = (shieldSkill: number, shieldBlockMod: number = 0): number => {
  return Math.floor(shieldSkill / 2) + 3 + shieldBlockMod;
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

export const getDefenseOptions = (
  character: CharacterSheet,
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

export const advanceTurn = (state: MatchState): MatchState => {
  if (state.players.length === 0) {
    return state;
  }
  const currentIndex = state.players.findIndex((player) => player.id === state.activeTurnPlayerId);
  const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % state.players.length;
  const round = nextIndex === 0 ? state.round + 1 : state.round;
  const nextPlayerId = state.players[nextIndex]?.id ?? "";

  const combatants = state.combatants.map(c => {
    if (c.playerId === nextPlayerId) {
      const cleanedEffects = c.statusEffects.filter(e => e !== 'shock' && e !== 'defending');
      return { ...c, maneuver: null, statusEffects: cleanedEffects };
    }
    return c;
  });

  return {
    ...state,
    combatants,
    activeTurnPlayerId: nextPlayerId,
    round,
  };
};

const isCriticalSuccess = (roll: number, target: number): boolean => {
  if (roll <= 4) return true;
  if (roll === 5 && target >= 15) return true;
  if (roll === 6 && target >= 16) return true;
  return false;
};

const isCriticalFailure = (roll: number, target: number): boolean => {
  if (roll === 18) return true;
  if (roll === 17 && target <= 15) return true;
  if (roll === 16 && target <= 6) return true;
  return false;
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

/**
 * GURPS damage type multipliers (vs torso):
 * - Crushing (cr): x1
 * - Cutting (cut): x1.5 (round down)
 * - Impaling (imp): x2
 * - Piercing (pi): x1
 */
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

export type PostureModifiers = {
  toHitMelee: number;
  toHitRanged: number;
  defenseVsMelee: number;
  defenseVsRanged: number;
  moveMultiplier: number;
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

export type HTCheckResult = {
  roll: number;
  target: number;
  success: boolean;
  margin: number;
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
