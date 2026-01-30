import type { WebSocket } from "ws";
import type { CharacterSheet, MatchState, User } from "../../shared/types";
import type { BetterSqliteDatabase, ConnectionState } from "./types";

class ServerState {
  users = new Map<string, User>();
  characters = new Map<string, CharacterSheet>();
  matches = new Map<string, MatchState>();
  connections = new Map<WebSocket, ConnectionState>();
  userSockets = new Map<string, Set<WebSocket>>();
  spectators = new Map<string, Set<string>>();
  botTimers = new Map<string, NodeJS.Timeout>();
  botCount = 1;
  readySets = new Map<string, Set<string>>();
  db!: BetterSqliteDatabase;

  setDb(db: BetterSqliteDatabase) {
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

  addSpectator(matchId: string, userId: string) {
    let specs = this.spectators.get(matchId);
    if (!specs) {
      specs = new Set();
      this.spectators.set(matchId, specs);
    }
    specs.add(userId);
  }

  removeSpectator(matchId: string, userId: string) {
    const specs = this.spectators.get(matchId);
    if (specs) {
      specs.delete(userId);
      if (specs.size === 0) {
        this.spectators.delete(matchId);
      }
    }
  }

  getSpectators(matchId: string): Set<string> {
    return this.spectators.get(matchId) ?? new Set();
  }

  isSpectating(matchId: string, userId: string): boolean {
    return this.spectators.get(matchId)?.has(userId) ?? false;
  }
}

export const state = new ServerState();
