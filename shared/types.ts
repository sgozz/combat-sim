export type Id = string;

export type Attributes = {
  strength: number;
  dexterity: number;
  intelligence: number;
  health: number;
};

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

export type CharacterSheet = {
  id: Id;
  name: string;
  attributes: Attributes;
  derived: DerivedStats;
  skills: Skill[];
  advantages: Advantage[];
  disadvantages: Disadvantage[];
  equipment: Equipment[];
  pointsTotal: number;
};

export type Player = {
  id: Id;
  name: string;
  isBot: boolean;
  characterId: Id;
};

export type GridPosition = {
  x: number;
  y: number;
  z: number;
};

// Hex position for movement calculations (axial coordinates)
export type HexCoord = {
  q: number;
  r: number;
};

// Turn movement state - tracks incremental movement during a turn
export type TurnMovementState = {
  startPosition: HexCoord;
  startFacing: number;
  currentPosition: HexCoord;
  currentFacing: number;
  movePointsRemaining: number;
  freeRotationUsed: boolean;
  movedBackward: boolean;
  phase: 'not_started' | 'moving' | 'completed';
};

// Reachable hex info sent to client
export type ReachableHexInfo = {
  q: number;
  r: number;
  cost: number;
  finalFacing: number;
};

export type ManeuverType = 
  | 'do_nothing' 
  | 'move' 
  | 'aim' 
  | 'evaluate'
  | 'attack' 
  | 'all_out_attack' 
  | 'all_out_defense' 
  | 'move_and_attack';

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

export type CombatantState = {
  playerId: Id;
  characterId: Id;
  position: GridPosition;
  facing: number;
  posture: Posture;
  maneuver: ManeuverType | null;
  aoaVariant: AOAVariant | null;
  aodVariant: AODVariant | null;
  currentHP: number;
  currentFP: number;
  statusEffects: string[];
  aimTurns: number;
  aimTargetId: Id | null;
  evaluateBonus: number;
  evaluateTargetId: Id | null;
  inCloseCombatWith: Id | null;
  closeCombatPosition: CloseCombatPosition | null;
  grapple: GrappleState | null;
  usedReaction: boolean;
  /** Shock penalty from damage taken this turn (0-4, clears at turn start) */
  shockPenalty: number;
  attacksRemaining: number;
  retreatedThisTurn: boolean;
  defensesThisTurn: number;
};

export type MatchState = {
  id: Id;
  players: Player[];
  characters: CharacterSheet[];
  combatants: CombatantState[];
  activeTurnPlayerId: Id;
  round: number;
  log: string[];
  winnerId?: Id;
  status: "active" | "finished";
  finishedAt?: number;
  turnMovement?: TurnMovementState;
  reachableHexes?: ReachableHexInfo[];
  pendingDefense?: PendingDefense;
};

export type LobbySummary = {
  id: Id;
  name: string;
  playerCount: number;
  maxPlayers: number;
  status: "open" | "in_match";
};

export type GrappleAction = 'grab' | 'throw' | 'lock' | 'choke' | 'pin' | 'release';

export type CombatActionPayload =
  | { type: "select_maneuver"; maneuver: ManeuverType; aoaVariant?: AOAVariant; aodVariant?: AODVariant }
  | { type: "attack"; targetId: Id; hitLocation?: HitLocation; deceptiveLevel?: 0 | 1 | 2 }
  | { type: "aim_target"; targetId: Id }
  | { type: "evaluate_target"; targetId: Id }
  | { type: "defend"; defenseType: DefenseType; retreat: boolean; dodgeAndDrop: boolean }
  | { type: "move"; position: GridPosition }
  | { type: "move_step"; to: HexCoord }
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

export type ClientToServerMessage =
  | { type: "auth"; name: string }
  | { type: "create_lobby"; name: string; maxPlayers: number }
  | { type: "join_lobby"; lobbyId: Id }
  | { type: "leave_lobby" }
  | { type: "delete_lobby"; lobbyId: Id }
  | { type: "list_lobbies" }
  | { type: "start_match" }
  | { type: "select_character"; character: CharacterSheet }
  | { type: "action"; action: CombatActionPayload["type"]; payload?: CombatActionPayload };

export type VisualEffect = 
  | { type: 'damage'; targetId: Id; value: number; position: GridPosition }
  | { type: 'miss'; targetId: Id; position: GridPosition }
  | { type: 'defend'; targetId: Id; position: GridPosition }
  | { type: 'grapple'; attackerId: Id; targetId: Id; position: GridPosition }
  | { type: 'close_combat'; attackerId: Id; targetId: Id; position: GridPosition };

export type PendingAction = 
  | { type: 'close_combat_request'; attackerId: Id; targetId: Id }
  | { type: 'exit_close_combat_request'; exitingId: Id; targetId: Id };

export type ServerToClientMessage =
  | { type: "auth_ok"; player: Player }
  | { type: "lobbies"; lobbies: LobbySummary[] }
  | { type: "lobby_joined"; lobbyId: Id; players: Player[] }
  | { type: "lobby_left" }
  | { type: "match_state"; state: MatchState }
  | { type: "visual_effect"; effect: VisualEffect }
  | { type: "pending_action"; action: PendingAction }
  | { type: "error"; message: string };
