import type {
  Abilities,
  AbilityModifier,
  PF2DerivedStats,
  Proficiency,
  DegreeOfSuccess,
  ActionCost,
  PF2Weapon,
  PF2CombatantState,
  PF2DamageType,
} from './types';
import type { MatchState, HexCoord, TurnMovementState, ReachableHexInfo } from '../../types';

export type D20RollResult = {
  roll: number;
  modifier: number;
  total: number;
  dc: number;
  degree: DegreeOfSuccess;
  natural20: boolean;
  natural1: boolean;
};

export type DamageRoll = {
  total: number;
  rolls: number[];
  modifier: number;
  damageType: PF2DamageType;
};

export type AttackResult = {
  attackRoll: D20RollResult;
  damage: DamageRoll | null;
  criticalSpecialization?: string;
};

const PROFICIENCY_BONUS: Record<Proficiency, number> = {
  untrained: 0,
  trained: 2,
  expert: 4,
  master: 6,
  legendary: 8,
};

export const roll1d20 = (random: () => number = Math.random): number => {
  return Math.floor(random() * 20) + 1;
};

export const rollDice = (
  count: number,
  sides: number,
  random: () => number = Math.random
): number[] => {
  return Array.from({ length: count }, () => Math.floor(random() * sides) + 1);
};

export const getAbilityModifier = (score: number): AbilityModifier => {
  const mod = Math.floor((score - 10) / 2);
  return Math.max(-5, Math.min(7, mod)) as AbilityModifier;
};

export const getProficiencyBonus = (proficiency: Proficiency, level: number): number => {
  if (proficiency === 'untrained') return 0;
  return PROFICIENCY_BONUS[proficiency] + level;
};

export const calculateDegreeOfSuccess = (
  roll: number,
  total: number,
  dc: number
): DegreeOfSuccess => {
  const isNat20 = roll === 20;
  const isNat1 = roll === 1;
  
  let baseDegree: DegreeOfSuccess;
  if (total >= dc + 10) {
    baseDegree = 'critical_success';
  } else if (total >= dc) {
    baseDegree = 'success';
  } else if (total <= dc - 10) {
    baseDegree = 'critical_failure';
  } else {
    baseDegree = 'failure';
  }
  
  if (isNat20) {
    if (baseDegree === 'critical_failure') return 'failure';
    if (baseDegree === 'failure') return 'success';
    if (baseDegree === 'success') return 'critical_success';
    return 'critical_success';
  }
  
  if (isNat1) {
    if (baseDegree === 'critical_success') return 'success';
    if (baseDegree === 'success') return 'failure';
    if (baseDegree === 'failure') return 'critical_failure';
    return 'critical_failure';
  }
  
  return baseDegree;
};

export const rollCheck = (
  modifier: number,
  dc: number,
  random: () => number = Math.random
): D20RollResult => {
  const roll = roll1d20(random);
  const total = roll + modifier;
  const degree = calculateDegreeOfSuccess(roll, total, dc);
  
  return {
    roll,
    modifier,
    total,
    dc,
    degree,
    natural20: roll === 20,
    natural1: roll === 1,
  };
};

export const calculateAC = (
  abilities: Abilities,
  armorBonus: number,
  proficiency: Proficiency,
  level: number,
  dexCap: number | null = null
): number => {
  const dexMod = getAbilityModifier(abilities.dexterity);
  const effectiveDex = dexCap !== null ? Math.min(dexMod, dexCap) : dexMod;
  const profBonus = getProficiencyBonus(proficiency, level);
  return 10 + effectiveDex + armorBonus + profBonus;
};

export const calculateSave = (
  abilities: Abilities,
  saveType: 'fortitude' | 'reflex' | 'will',
  proficiency: Proficiency,
  level: number
): number => {
  const abilityMap = {
    fortitude: 'constitution',
    reflex: 'dexterity',
    will: 'wisdom',
  } as const;
  
  const abilityMod = getAbilityModifier(abilities[abilityMap[saveType]]);
  const profBonus = getProficiencyBonus(proficiency, level);
  return abilityMod + profBonus;
};

export const calculateDerivedStats = (
  abilities: Abilities,
  level: number,
  classHP: number,
  armorBonus: number = 0,
  armorDexCap: number | null = null,
  saveProficiencies: Record<'fortitude' | 'reflex' | 'will', Proficiency> = {
    fortitude: 'trained',
    reflex: 'trained',
    will: 'trained',
  },
  perceptionProficiency: Proficiency = 'trained',
  armorProficiency: Proficiency = 'trained'
): PF2DerivedStats => {
  const conMod = getAbilityModifier(abilities.constitution);
  const hitPoints = classHP + (conMod * level) + (abilities.constitution - 10);
  
  return {
    hitPoints,
    armorClass: calculateAC(abilities, armorBonus, armorProficiency, level, armorDexCap),
    fortitudeSave: calculateSave(abilities, 'fortitude', saveProficiencies.fortitude, level),
    reflexSave: calculateSave(abilities, 'reflex', saveProficiencies.reflex, level),
    willSave: calculateSave(abilities, 'will', saveProficiencies.will, level),
    perception: getAbilityModifier(abilities.wisdom) + getProficiencyBonus(perceptionProficiency, level),
    speed: 25,
  };
};

export const getMultipleAttackPenalty = (
  attackNumber: number,
  isAgile: boolean
): number => {
  if (attackNumber <= 1) return 0;
  if (attackNumber === 2) return isAgile ? -4 : -5;
  return isAgile ? -8 : -10;
};

export const calculateAttackBonus = (
  abilities: Abilities,
  weapon: PF2Weapon,
  level: number,
  mapPenalty: number = 0
): number => {
  const isFinesse = weapon.traits.includes('finesse');
  const abilityMod = isFinesse
    ? Math.max(getAbilityModifier(abilities.strength), getAbilityModifier(abilities.dexterity))
    : getAbilityModifier(abilities.strength);
  
  const profBonus = getProficiencyBonus(weapon.proficiency, level);
  return abilityMod + profBonus + mapPenalty;
};

export const rollDamage = (
  formula: string,
  damageType: PF2DamageType,
  random: () => number = Math.random
): DamageRoll => {
  const match = formula.trim().match(/(\d+)d(\d+)([+-]\d+)?/i);
  if (!match) {
    return { total: 0, rolls: [], modifier: 0, damageType };
  }
  
  const diceCount = Number(match[1]);
  const diceSides = Number(match[2]);
  const modifier = Number(match[3] ?? 0);
  const rolls = rollDice(diceCount, diceSides, random);
  const total = rolls.reduce((sum, r) => sum + r, 0) + modifier;
  
  return { total: Math.max(0, total), rolls, modifier, damageType };
};

export const resolveStrike = (
  attacker: { abilities: Abilities; level: number },
  weapon: PF2Weapon,
  targetAC: number,
  mapPenalty: number,
  random: () => number = Math.random
): AttackResult => {
  const attackBonus = calculateAttackBonus(
    attacker.abilities,
    weapon,
    attacker.level,
    mapPenalty
  );
  
  const attackRoll = rollCheck(attackBonus, targetAC, random);
  
  if (attackRoll.degree === 'critical_failure' || attackRoll.degree === 'failure') {
    return { attackRoll, damage: null };
  }
  
  const strMod = getAbilityModifier(attacker.abilities.strength);
  const baseDamage = `${weapon.damage}+${strMod}`;
  let damage = rollDamage(baseDamage, weapon.damageType, random);
  
  if (attackRoll.degree === 'critical_success') {
    damage = {
      ...damage,
      total: damage.total * 2,
    };
  }
  
  return { attackRoll, damage };
};

export const getActionCost = (actionType: string): ActionCost => {
  switch (actionType) {
    case 'strike':
    case 'stride':
    case 'interact':
    case 'raise_shield':
    case 'take_cover':
    case 'stand':
    case 'grapple':
    case 'shove':
    case 'trip':
    case 'disarm':
    case 'feint':
    case 'demoralize':
    case 'escape':
      return 1;
    case 'ready':
      return 2;
    case 'step':
      return 1;
    case 'release':
    case 'drop_prone':
      return 'free';
    default:
      return 1;
  }
};

export const canPerformAction = (
  combatant: PF2CombatantState,
  actionCost: ActionCost
): boolean => {
  if (actionCost === 'free') return true;
  if (actionCost === 'reaction') return combatant.reactionAvailable;
  return combatant.actionsRemaining >= actionCost;
};

export const applyActionCost = (
  combatant: PF2CombatantState,
  actionCost: ActionCost,
  isAttack: boolean = false
): PF2CombatantState => {
  let reactionAvailable = combatant.reactionAvailable;
  let actionsRemaining = combatant.actionsRemaining;
  let mapPenalty = combatant.mapPenalty;
  
  if (actionCost === 'reaction') {
    reactionAvailable = false;
  } else if (typeof actionCost === 'number') {
    actionsRemaining = Math.max(0, combatant.actionsRemaining - actionCost);
  }
  
  if (isAttack) {
    const isAgile = false;
    mapPenalty = getMultipleAttackPenalty(
      Math.abs(combatant.mapPenalty / (isAgile ? 4 : 5)) + 2,
      isAgile
    );
  }
  
  return { ...combatant, reactionAvailable, actionsRemaining, mapPenalty };
};

export const startNewTurn = (combatant: PF2CombatantState): PF2CombatantState => {
  let actions = 3;
  
  const slowed = combatant.conditions.find(c => c.condition === 'slowed');
  if (slowed?.value) {
    actions = Math.max(0, actions - slowed.value);
  }
  
  const stunned = combatant.conditions.find(c => c.condition === 'stunned');
  if (stunned?.value) {
    actions = Math.max(0, actions - stunned.value);
  }
  
  const quickened = combatant.conditions.find(c => c.condition === 'quickened');
  if (quickened) {
    actions += 1;
  }
  
  return {
    ...combatant,
    actionsRemaining: actions,
    reactionAvailable: true,
    mapPenalty: 0,
    shieldRaised: false,
  };
};

export const advanceTurn = (state: MatchState): MatchState => {
  if (state.players.length === 0) {
    return state;
  }
  
  const currentIndex = state.players.findIndex(p => p.id === state.activeTurnPlayerId);
  const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % state.players.length;
  const round = nextIndex === 0 ? state.round + 1 : state.round;
  const nextPlayerId = state.players[nextIndex]?.id ?? '';
  
  const updatedCombatants = state.combatants.map(c => {
    if (c.playerId === nextPlayerId && c.pf2) {
      return {
        ...c,
        attacksRemaining: 3,
        pf2: {
          ...c.pf2,
          actionsRemaining: 3,
          reactionAvailable: true,
          mapPenalty: 0,
          attacksThisTurn: 0,
          shieldRaised: false,
        },
      };
    }
    return c;
  });
  
  return {
    ...state,
    combatants: updatedCombatants,
    activeTurnPlayerId: nextPlayerId,
    round,
    turnMovement: undefined,
    reachableHexes: undefined,
  };
};

import { squareGrid8 } from '../../grid';
import type { GridCoord } from '../../grid';

export type SquarePosition = GridCoord;

const grid = squareGrid8;

export const getSquareNeighbor = (pos: SquarePosition, direction: number): SquarePosition => {
  return grid.getNeighborInDirection(pos, direction);
};

export const squareDistance = (a: SquarePosition, b: SquarePosition): number => {
  return grid.distance(a, b);
};

export const getReachableSquares = (
  startPos: SquarePosition,
  speed: number,
  occupiedSquares: SquarePosition[] = []
): Map<string, { position: SquarePosition; cost: number }> => {
  const results = new Map<string, { position: SquarePosition; cost: number }>();
  const visited = new Set<string>();
  const queue: { pos: SquarePosition; cost: number }[] = [{ pos: startPos, cost: 0 }];
  
  const coordKey = (p: SquarePosition) => `${p.q},${p.r}`;
  const isOccupied = (p: SquarePosition) => occupiedSquares.some(o => o.q === p.q && o.r === p.r);
  const feetPerSquare = 5;
  const maxSquares = Math.floor(speed / feetPerSquare);
  
  while (queue.length > 0) {
    queue.sort((a, b) => a.cost - b.cost);
    const current = queue.shift()!;
    const key = coordKey(current.pos);
    
    if (visited.has(key)) continue;
    visited.add(key);
    
    if (current.cost > 0) {
      results.set(key, { position: current.pos, cost: current.cost });
    }
    
    if (current.cost >= maxSquares) continue;
    
    const neighbors = grid.neighbors(current.pos);
    for (const neighbor of neighbors) {
      if (isOccupied(neighbor)) continue;
      queue.push({ pos: neighbor, cost: current.cost + 1 });
    }
  }
  
  return results;
};

export const initializeTurnMovement = (
  position: HexCoord,
  facing: number,
  basicMove: number
): TurnMovementState => {
  return {
    startPosition: { ...position },
    startFacing: facing,
    currentPosition: { ...position },
    currentFacing: facing,
    movePointsRemaining: basicMove,
    freeRotationUsed: false,
    movedBackward: false,
    phase: 'moving',
  };
};

export const calculateReachableHexesInfo = (
  state: TurnMovementState,
  occupiedSquares: HexCoord[]
): ReachableHexInfo[] => {
  const speed = state.movePointsRemaining * 5;
  const reachable = getReachableSquares(state.currentPosition, speed, occupiedSquares);
  
  const result: ReachableHexInfo[] = [];
  reachable.forEach((cell) => {
    result.push({
      q: cell.position.q,
      r: cell.position.r,
      cost: cell.cost,
      finalFacing: state.currentFacing,
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

export type MovementState = {
  position: HexCoord;
  facing: number;
  movePointsRemaining: number;
  freeRotationUsed: boolean;
  movedBackward: boolean;
};

export const executeMove = (
  state: MovementState,
  targetHex: HexCoord,
  occupiedHexes: HexCoord[]
): MovementState | null => {
  const isOccupied = occupiedHexes.some(h => h.q === targetHex.q && h.r === targetHex.r);
  if (isOccupied) return null;
  
  const dx = Math.abs(targetHex.q - state.position.q);
  const dz = Math.abs(targetHex.r - state.position.r);
  const chebyshevDistance = Math.max(dx, dz);
  
  if (chebyshevDistance > state.movePointsRemaining) return null;
  
  return {
    position: { ...targetHex },
    facing: state.facing,
    movePointsRemaining: state.movePointsRemaining - chebyshevDistance,
    freeRotationUsed: state.freeRotationUsed,
    movedBackward: state.movedBackward,
  };
};
