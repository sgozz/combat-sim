import type { WebSocket } from "ws";
import type { CharacterSheet, MatchState, Player } from "../../shared/types";
import type { SqliteDatabase, Lobby, ConnectionState } from "./types";

class ServerState {
  players = new Map<string, Player>();
  playerCharacters = new Map<string, CharacterSheet>();
  lobbies = new Map<string, Lobby>();
  connections = new Map<WebSocket, ConnectionState>();
  matches = new Map<string, MatchState>();
  botTimers = new Map<string, NodeJS.Timeout>();
  botCount = 1;
  db!: SqliteDatabase;

  setDb(db: SqliteDatabase) {
    this.db = db;
  }
}

export const state = new ServerState();
