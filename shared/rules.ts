import type { Attributes, DerivedStats, MatchState } from "./types";

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

export const advanceTurn = (state: MatchState): MatchState => {
  if (state.players.length === 0) {
    return state;
  }
  const currentIndex = state.players.findIndex((player) => player.id === state.activeTurnPlayerId);
  const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % state.players.length;
  const round = nextIndex === 0 ? state.round + 1 : state.round;
  const nextPlayerId = state.players[nextIndex]?.id ?? "";

  const combatants = state.combatants.map(c => 
    c.playerId === nextPlayerId ? { ...c, maneuver: null } : c
  );

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
