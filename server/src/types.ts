import type { WebSocket } from "ws";
import type { Database } from "sqlite";
import type sqlite3 from "sqlite3";

export type SqliteDatabase = Database<sqlite3.Database, sqlite3.Statement>;

export type Lobby = {
  id: string;
  name: string;
  maxPlayers: number;
  players: import("../../shared/types").Player[];
  status: "open" | "in_match";
};

export type ConnectionState = {
  sessionToken?: string;
  userId?: string;
  playerId?: string;
  lobbyId?: string;
};

export type PlayerRow = {
  id: string | null;
  name: string;
  character_id: string | null;
  lobby_id: string | null;
  is_bot: number | null;
};

export type LobbyRow = {
  id: string;
  name: string;
  max_players: number;
  status: "open" | "in_match";
  players_json: string | null;
};

export type MatchRow = {
  lobby_id: string;
  state_json: string;
};

export type CharacterRow = {
  id: string;
  data: string;
};

export type ServerState = {
  players: Map<string, import("../../shared/types").Player>;
  playerCharacters: Map<string, import("../../shared/types").CharacterSheet>;
  lobbies: Map<string, Lobby>;
  connections: Map<WebSocket, ConnectionState>;
  matches: Map<string, import("../../shared/types").MatchState>;
  botTimers: Map<string, NodeJS.Timeout>;
  botCount: number;
  db: SqliteDatabase;
};
