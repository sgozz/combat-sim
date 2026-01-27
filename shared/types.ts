import type { CombatantState, CombatActionPayload, PendingDefenseState } from './rulesets';
import type { CharacterSheet } from './rulesets/characterSheet';

export { isPF2Character, isGurpsCharacter } from './rulesets/characterSheet';
export type { CharacterSheet } from './rulesets/characterSheet';

export type Id = string;

export type RulesetId = 'gurps' | 'pf2';



export type User = {
  id: Id;
  username: string;
  isBot: boolean;
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

export type HexCoord = {
  q: number;
  r: number;
};

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

export type ReachableHexInfo = {
  q: number;
  r: number;
  cost: number;
  finalFacing: number;
};

export type MatchStatus = "waiting" | "active" | "paused" | "finished";

export type MatchState = {
  id: Id;
  name: string;
  code: string;
  maxPlayers: number;
  rulesetId: RulesetId;
  players: Player[];
  characters: CharacterSheet[];
  combatants: CombatantState[];
  activeTurnPlayerId: Id;
  round: number;
  log: string[];
  winnerId?: Id;
  status: MatchStatus;
  pausedForPlayerId?: Id;
  createdAt: number;
  finishedAt?: number;
  turnMovement?: TurnMovementState;
  reachableHexes?: ReachableHexInfo[];
   pendingDefense?: PendingDefenseState;
};

export type MatchSummary = {
  id: Id;
  code: string;
  name: string;
  creatorId: Id;
  playerCount: number;
  maxPlayers: number;
  rulesetId: RulesetId;
  status: MatchStatus;
  players: { id: Id; name: string; isConnected: boolean }[];
  isMyTurn: boolean;
  winnerId?: Id;
  winnerName?: string;
};

export type ClientToServerMessage =
  | { type: "register"; username: string }
  | { type: "auth"; sessionToken: string }
  | { type: "create_match"; name: string; maxPlayers: number; rulesetId: RulesetId }
  | { type: "join_match"; code: string }
  | { type: "leave_match"; matchId: Id }
  | { type: "rejoin_match"; matchId: Id }
  | { type: "list_my_matches" }
  | { type: "list_public_matches" }
  | { type: "spectate_match"; matchId: Id }
  | { type: "stop_spectating"; matchId: Id }
  | { type: "start_combat"; matchId: Id; botCount?: number }
  | { type: "select_character"; matchId: Id; character: CharacterSheet }
  | { type: "action"; matchId: Id; action: CombatActionPayload["type"]; payload?: CombatActionPayload };

export type VisualEffect = 
  | { type: 'damage'; attackerId: Id; targetId: Id; value: number; position: GridPosition }
  | { type: 'miss'; attackerId: Id; targetId: Id; position: GridPosition }
  | { type: 'defend'; attackerId: Id; targetId: Id; position: GridPosition }
  | { type: 'grapple'; attackerId: Id; targetId: Id; position: GridPosition }
  | { type: 'close_combat'; attackerId: Id; targetId: Id; position: GridPosition };

export type PendingAction = 
  | { type: 'close_combat_request'; attackerId: Id; targetId: Id }
  | { type: 'exit_close_combat_request'; exitingId: Id; targetId: Id };

export type ServerToClientMessage =
   | { type: "auth_ok"; user: User; sessionToken: string }
   | { type: "session_invalid" }
   | { type: "my_matches"; matches: MatchSummary[] }
   | { type: "public_matches"; matches: MatchSummary[] }
   | { type: "match_created"; match: MatchSummary }
   | { type: "match_joined"; matchId: Id }
   | { type: "match_left"; matchId: Id }
   | { type: "match_state"; state: MatchState }
   | { type: "spectating"; matchId: Id }
   | { type: "stopped_spectating"; matchId: Id }
   | { type: "match_updated"; match: MatchSummary }
   | { type: "player_joined"; matchId: Id; player: Player }
   | { type: "player_left"; matchId: Id; playerId: Id; playerName: string }
   | { type: "player_disconnected"; matchId: Id; playerId: Id; playerName: string }
   | { type: "player_reconnected"; matchId: Id; playerId: Id; playerName: string }
   | { type: "visual_effect"; matchId: Id; effect: VisualEffect }
   | { type: "pending_action"; matchId: Id; action: PendingAction }
   | { type: "error"; message: string };
