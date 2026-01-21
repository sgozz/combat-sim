import type { WebSocket } from "ws";
import type { Database } from "sqlite";
import type sqlite3 from "sqlite3";

export type SqliteDatabase = Database<sqlite3.Database, sqlite3.Statement>;

export type ConnectionState = {
  sessionToken?: string;
  userId?: string;
};

export type UserRow = {
  id: string;
  username: string;
  is_bot: number;
  default_character_id: string | null;
  created_at: number;
};

export type SessionRow = {
  token: string;
  user_id: string;
  created_at: number;
  last_seen_at: number | null;
};

export type CharacterRow = {
  id: string;
  owner_id: string;
  name: string;
  data_json: string;
  created_at: number;
};

export type MatchRow = {
  id: string;
  code: string;
  name: string;
  max_players: number;
  status: string;
  state_json: string | null;
  created_by: string;
  winner_id: string | null;
  ruleset_id: string;
  created_at: number;
  finished_at: number | null;
};

export type MatchMemberRow = {
  match_id: string;
  user_id: string;
  character_id: string | null;
  is_connected: number;
  joined_at: number;
};
