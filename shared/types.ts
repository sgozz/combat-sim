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

export type Equipment = {
  id: Id;
  name: string;
  damage?: string;
  range?: string;
  weight?: number;
};

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

export type CombatantState = {
  playerId: Id;
  characterId: Id;
  position: GridPosition;
  currentHP: number;
  currentFP: number;
  statusEffects: string[];
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
};

export type LobbySummary = {
  id: Id;
  name: string;
  playerCount: number;
  maxPlayers: number;
  status: "open" | "in_match";
};

export type CombatActionPayload =
  | { type: "attack"; targetId: Id }
  | { type: "defend" }
  | { type: "move"; position: GridPosition }
  | { type: "end_turn" };

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

export type ServerToClientMessage =
  | { type: "auth_ok"; player: Player }
  | { type: "lobbies"; lobbies: LobbySummary[] }
  | { type: "lobby_joined"; lobbyId: Id; players: Player[] }
  | { type: "lobby_left" }
  | { type: "match_state"; state: MatchState }
  | { type: "error"; message: string };
