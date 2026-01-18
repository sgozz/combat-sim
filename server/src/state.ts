import type { WebSocket } from "ws";
import type { CharacterSheet, MatchState, User } from "../../shared/types";
import type { SqliteDatabase, ConnectionState } from "./types";

class ServerState {
  users = new Map<string, User>();
  characters = new Map<string, CharacterSheet>();
  matches = new Map<string, MatchState>();
  connections = new Map<WebSocket, ConnectionState>();
  userSockets = new Map<string, Set<WebSocket>>();
  botTimers = new Map<string, NodeJS.Timeout>();
  botCount = 1;
  db!: SqliteDatabase;

  setDb(db: SqliteDatabase) {
    this.db = db;
  }

  addUserSocket(userId: string, socket: WebSocket) {
    let sockets = this.userSockets.get(userId);
    if (!sockets) {
      sockets = new Set();
      this.userSockets.set(userId, sockets);
    }
    sockets.add(socket);
  }

  removeUserSocket(userId: string, socket: WebSocket) {
    const sockets = this.userSockets.get(userId);
    if (sockets) {
      sockets.delete(socket);
      if (sockets.size === 0) {
        this.userSockets.delete(userId);
      }
    }
  }

  isUserConnected(userId: string): boolean {
    const sockets = this.userSockets.get(userId);
    return sockets !== undefined && sockets.size > 0;
  }

  getUserSockets(userId: string): Set<WebSocket> {
    return this.userSockets.get(userId) ?? new Set();
  }
}

export const state = new ServerState();
