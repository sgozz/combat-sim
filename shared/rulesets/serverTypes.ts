import type { Id, HexCoord, MatchState, CharacterSheet, GridPosition } from '../types';
import type { CombatantState } from './index';
import type { Posture, DefenseType } from './gurps/types';

export type DamageSpec = {
  formula: string;
  type: string;
  total?: number;
  rolls?: number[];
  modifier?: number;
};

export type RollResult = {
  target: number;
  roll: number;
  success: boolean;
  margin: number;
  dice: number[];
  critical?: boolean;
  fumble?: boolean;
};

export type AttackRequest = {
  match: MatchState;
  attackerId: Id;
  targetId: Id;
  hitLocation?: string;
  deceptiveLevel?: number;
  rapidStrike?: boolean;
};

export type AttackResult = {
  ok: true;
  hit: boolean;
  critical: boolean;
  fumble: boolean;
  roll: RollResult;
  damage?: DamageSpec;
  pendingDefense?: boolean;
  logEntries: string[];
  effects?: AttackEffect[];
} | {
  ok: false;
  error: 'not_supported' | 'invalid_target' | 'out_of_range' | 'no_weapon' | 'invalid_maneuver';
  message: string;
};

export type AttackEffect = {
  type: 'damage' | 'status' | 'position' | 'critical';
  targetId: Id;
  value?: number;
  status?: string;
  description?: string;
};

export type DefenseOption = {
  type: DefenseType;
  value: number;
  available: boolean;
  canRetreat: boolean;
  canDodgeAndDrop?: boolean;
  weaponName?: string;
};

export type DefenseRequest = {
  match: MatchState;
  defenderId: Id;
  attackerId: Id;
  attackRoll: RollResult;
  defenseType: DefenseType;
  retreat: boolean;
  dodgeAndDrop?: boolean;
  damage: DamageSpec;
  hitLocation: string;
  deceptivePenalty?: number;
};

export type DefenseResult = {
  ok: true;
  defended: boolean;
  roll: RollResult;
  retreatUsed: boolean;
  logEntries: string[];
  damage?: ResolvedDamage;
  effects?: DefenseEffect[];
} | {
  ok: false;
  error: 'not_supported' | 'invalid_defense';
  message: string;
};

export type DefenseEffect = {
  type: 'position' | 'posture' | 'status';
  targetId: Id;
  position?: GridPosition;
  posture?: Posture;
  status?: string;
};

export type ResolvedDamage = {
  total: number;
  damageType: string;
  logEntry: string;
  effects: DamageEffect[];
};

export type DamageEffect = {
  type: 'hp_change' | 'status' | 'unconscious' | 'death' | 'major_wound' | 'stun';
  targetId: Id;
  value?: number;
  status?: string;
  description?: string;
};

export type DamageRequest = {
  match: MatchState;
  targetId: Id;
  damage: DamageSpec;
  hitLocation: string;
  attackerId?: Id;
  critical?: boolean;
};

export type DamageResult = {
  ok: true;
  finalDamage: number;
  updatedCombatants: CombatantState[];
  logEntries: string[];
  effects: DamageEffect[];
} | {
  ok: false;
  error: 'not_supported' | 'invalid_target';
  message: string;
};

export type CloseCombatRequest = {
  match: MatchState;
  attackerId: Id;
  targetId: Id;
  action: 'enter' | 'exit' | 'grapple' | 'break_free' | 'technique';
  techniqueType?: string;
};

export type CloseCombatResult = {
  ok: true;
  success: boolean;
  roll?: RollResult;
  contestRoll?: { attacker: RollResult; defender: RollResult; attackerWins: boolean };
  logEntries: string[];
  updatedCombatants: CombatantState[];
  effects?: CloseCombatEffect[];
} | {
  ok: false;
  error: 'not_supported' | 'not_adjacent' | 'already_in_close_combat' | 'not_in_close_combat';
  message: string;
};

export type CloseCombatEffect = {
  type: 'enter' | 'exit' | 'grapple' | 'position';
  attackerId: Id;
  targetId: Id;
  position?: GridPosition;
};

export type MovementState = {
  position: HexCoord;
  facing: number;
  movePointsRemaining: number;
  freeRotationUsed: boolean;
  movedBackward: boolean;
};

export type MoveRequest = {
  state: MovementState;
  targetHex: HexCoord;
  occupiedHexes: HexCoord[];
};

export type MoveResult = {
  ok: true;
  newState: MovementState;
} | {
  ok: false;
  error: 'too_far' | 'occupied' | 'invalid';
  message: string;
};

export type RotateRequest = {
  state: MovementState;
  newFacing: number;
};

export type RotateResult = {
  ok: true;
  newState: MovementState;
} | {
  ok: false;
  error: 'no_points' | 'invalid';
  message: string;
};

export type EncumbranceInfo = {
  level: number;
  name: string;
  movePenalty: number;
  dodgePenalty: number;
  totalWeight: number;
  basicLift: number;
};

export type PostureModifiers = {
  toHitMelee: number;
  toHitRanged: number;
  defenseVsMelee: number;
  defenseVsRanged: number;
  moveMultiplier: number;
};

export type BotDefenseChoice = {
  defenseType: DefenseType;
  retreat: boolean;
  dodgeAndDrop: boolean;
};

export type BotActionRequest = {
  match: MatchState;
  botCombatant: CombatantState;
  botCharacter: CharacterSheet;
};

export type BotAttackResult = {
  ok: true;
  updatedMatch: MatchState;
  logEntries: string[];
} | {
  ok: false;
  error: string;
  message: string;
};

export type RulesetCapabilities = {
  closeCombat: boolean;
  calledShots: boolean;
  criticalTables: boolean;
  maneuvers: boolean;
  multipleAttacks: boolean;
  reactionDefense: boolean;
  fatiguePoints: boolean;
  encumbrance: boolean;
  facing: boolean;
  retreat: boolean;
};

export type RulesetResult<T> = 
  | { ok: true } & T
  | { ok: false; error: string; message: string };
