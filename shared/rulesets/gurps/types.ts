// GURPS-specific types
// These are the types specific to the GURPS ruleset

import type { Id } from '../../types';
import type { BaseCombatantState } from '../base/types';

// GURPS Attributes (ST, DX, IQ, HT)
// PF2 adds wisdom and charisma (optional for GURPS compatibility)
export type Attributes = {
  strength: number;
  dexterity: number;
  intelligence: number;
  health: number;  // HT in GURPS, CON in PF2
  wisdom?: number;     // PF2 only
  charisma?: number;   // PF2 only
};

// GURPS Derived Stats
export type DerivedStats = {
  hitPoints: number;
  fatiguePoints: number;
  basicSpeed: number;
  basicMove: number;
  dodge: number;
};

export type Skill = {
  id: Id;
  name: string;
  level: number;
};

export type Advantage = {
  id: Id;
  name: string;
  description?: string;
};

export type Disadvantage = {
  id: Id;
  name: string;
  description?: string;
};

export type EquipmentType = 'melee' | 'ranged' | 'shield' | 'armor' | 'other';

export type DamageType = 'crushing' | 'cutting' | 'impaling' | 'piercing';

export type Posture = 'standing' | 'crouching' | 'kneeling' | 'prone';

export type HitLocation = 
  | 'eye'
  | 'skull'
  | 'face'
  | 'neck'
  | 'torso'
  | 'vitals'
  | 'groin'
  | 'arm_right'
  | 'arm_left'
  | 'hand_right'
  | 'hand_left'
  | 'leg_right'
  | 'leg_left'
  | 'foot_right'
  | 'foot_left';

// Reach: "C" = close combat only, "1" = 1 hex, "C,1" = both, "1,2" = 1 or 2 hexes
export type Reach = 'C' | '1' | '2' | '3' | 'C,1' | '1,2' | '2,3';

export type ShieldSize = 'small' | 'medium' | 'large';

export type Equipment = {
  id: Id;
  name: string;
  type: EquipmentType;
  damage?: string;
  damageType?: DamageType;
  range?: string;
  weight?: number;
  accuracy?: number;
  reach?: Reach;
  parry?: number;
  block?: number;
  shieldSize?: ShieldSize;
  skillUsed?: string;
};

// Grappling states
export type GrappleState = {
  grappledBy: Id | null;
  grappling: Id | null;
  cpSpent: number; // Control Points spent on grapple
  cpReceived: number; // Control Points received from grappler
};

// Close combat relative position
export type CloseCombatPosition = 'front' | 'side' | 'back';

export type EquipmentSlot = 'right_hand' | 'left_hand' | 'back' | 'belt' | 'quiver';

export type EquippedItem = {
  equipmentId: Id;
  slot: EquipmentSlot;
  ready: boolean;
};

export type ReadyAction = 'draw' | 'sheathe' | 'pickup' | 'reload' | 'prepare';

export type ManeuverType =
  | 'do_nothing' 
  | 'move' 
  | 'aim' 
  | 'evaluate'
  | 'ready'
  | 'wait'
  | 'change_posture'
  | 'attack' 
  | 'all_out_attack' 
  | 'all_out_defense' 
  | 'move_and_attack'
  | 'pf2_step';

export type WaitTriggerCondition = 
  | 'enemy_moves_adjacent'
  | 'enemy_attacks_me'
  | 'enemy_attacks_ally'
  | 'enemy_enters_reach';

export type WaitTriggerAction = 'attack' | 'move' | 'ready';

export type WaitTrigger = {
  condition: WaitTriggerCondition;
  targetId?: Id;
  action: WaitTriggerAction;
};

export type AOAVariant = 'determined' | 'strong' | 'double' | 'feint';

// All-Out Defense variants (B366)
// - increased_dodge/parry/block: +2 to that specific defense
// - double: Can use two different defenses against the same attack
export type AODVariant = 'increased_dodge' | 'increased_parry' | 'increased_block' | 'double';

// Defense system types (B374-377)
export type DefenseType = 'dodge' | 'parry' | 'block' | 'none';

export type DefenseChoice = {
  type: DefenseType;
  retreat: boolean;
  dodgeAndDrop: boolean; // +3 to Dodge but end up prone
};

/** Pending defense state - attack landed, waiting for defender to choose */
export type PendingDefense = {
  attackerId: Id;
  defenderId: Id;
  attackRoll: number;
  attackMargin: number; // How much the attack succeeded by
  hitLocation: HitLocation;
  weapon: string;
  damage: string; // Damage formula (e.g., "2d+1")
  damageType: DamageType;
  deceptivePenalty: number; // Defense penalty from deceptive attack
  timestamp: number; // When the attack was made (for timeout)
};

export type GrappleAction = 'grab' | 'throw' | 'lock' | 'choke' | 'pin' | 'release';

export type GurpsCombatActionPayload =
  | { type: "select_maneuver"; maneuver: ManeuverType; aoaVariant?: AOAVariant; aodVariant?: AODVariant }
  | { type: "attack"; targetId: Id; hitLocation?: HitLocation; deceptiveLevel?: 0 | 1 | 2; rapidStrike?: boolean }
  | { type: "aim_target"; targetId: Id }
  | { type: "evaluate_target"; targetId: Id }
  | { type: "set_wait_trigger"; trigger: WaitTrigger }
  | { type: "ready_action"; action: ReadyAction; itemId: Id; targetSlot?: EquipmentSlot }
  | { type: "defend"; defenseType: DefenseType; retreat: boolean; dodgeAndDrop: boolean }
  | { type: "move"; position: { x: number; y: number; z: number } }
  | { type: "move_step"; to: { q: number; r: number } }
  | { type: "rotate"; facing: number }
  | { type: "undo_movement" }
  | { type: "confirm_movement" }
  | { type: "skip_movement" }
  | { type: "turn_left" }
  | { type: "turn_right" }
  | { type: "change_posture"; posture: Posture }
  | { type: "end_turn" }
  | { type: "enter_close_combat"; targetId: Id }
  | { type: "exit_close_combat" }
  | { type: "grapple"; targetId: Id; action: GrappleAction }
  | { type: "break_free" }
  | { type: "respond_close_combat"; accept: boolean }
  | { type: "respond_exit"; response: 'let_go' | 'follow' | 'attack' }
  | { type: "surrender" };

export type CombatActionPayload = GurpsCombatActionPayload;

export type PF2CombatantExtension = {
  actionsRemaining: number;
  reactionAvailable: boolean;
  mapPenalty: number;
  attacksThisTurn: number;
  shieldRaised: boolean;
};

export type GurpsCombatantState = BaseCombatantState & {
  rulesetId: 'gurps';
  posture: Posture;
  maneuver: ManeuverType | null;
  aoaVariant: AOAVariant | null;
  aodVariant: AODVariant | null;
  currentFP: number;
  aimTurns: number;
  aimTargetId: Id | null;
  evaluateBonus: number;
  evaluateTargetId: Id | null;
  equipped: EquippedItem[];
  inCloseCombatWith: Id | null;
  closeCombatPosition: CloseCombatPosition | null;
  grapple: GrappleState | null;
  shockPenalty: number;
  attacksRemaining: number;
  retreatedThisTurn: boolean;
  defensesThisTurn: number;
  parryWeaponsUsedThisTurn: string[];
  waitTrigger: WaitTrigger | null;
  pf2?: PF2CombatantExtension;
};

// Backward compatibility alias
export type CombatantState = GurpsCombatantState;
