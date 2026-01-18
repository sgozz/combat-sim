import path from "node:path";
import { randomUUID } from "node:crypto";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import type { CharacterSheet, MatchState, Player } from "../../shared/types";
import type { SqliteDatabase, CharacterRow, PlayerRow, LobbyRow, MatchRow, Lobby } from "./types";
import { state } from "./state";

const DB_PATH = path.join(process.cwd(), "data.sqlite");

export const initializeDatabase = async (): Promise<SqliteDatabase> => {
  const db = await open({ filename: DB_PATH, driver: sqlite3.Database });
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      last_login_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      last_seen_at INTEGER,
      lobby_id TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE,
      character_id TEXT,
      lobby_id TEXT,
      is_bot INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS characters (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      data TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS lobbies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      max_players INTEGER NOT NULL,
      status TEXT NOT NULL,
      players_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS matches (
      lobby_id TEXT PRIMARY KEY,
      state_json TEXT NOT NULL
    );
  `);

  const playerColumns = await db.all("PRAGMA table_info(players)") as { name: string }[];
  const columnNames = new Set(playerColumns.map((column) => column.name));
  if (!columnNames.has("lobby_id")) {
    await db.exec("ALTER TABLE players ADD COLUMN lobby_id TEXT");
  }
  if (!columnNames.has("is_bot")) {
    await db.exec("ALTER TABLE players ADD COLUMN is_bot INTEGER DEFAULT 0");
  }
  if (!columnNames.has("id")) {
    await db.exec("ALTER TABLE players ADD COLUMN id TEXT");
  }

  const missingIds = await db.all("SELECT name FROM players WHERE id IS NULL") as { name: string }[];
  for (const row of missingIds) {
    await db.run("UPDATE players SET id = ? WHERE name = ?", randomUUID(), row.name);
  }

  return db;
};

export type User = {
  id: string;
  username: string;
  createdAt: number;
  lastLoginAt: number | null;
};

export type Session = {
  token: string;
  userId: string;
  createdAt: number;
  lastSeenAt: number | null;
  lobbyId: string | null;
};

export const findUserByUsername = async (username: string): Promise<User | null> => {
  const row = await state.db.get<{ id: string; username: string; created_at: number; last_login_at: number | null }>(
    "SELECT id, username, created_at, last_login_at FROM users WHERE username = ?",
    username
  );
  if (!row) return null;
  return { id: row.id, username: row.username, createdAt: row.created_at, lastLoginAt: row.last_login_at };
};

export const findUserById = async (userId: string): Promise<User | null> => {
  const row = await state.db.get<{ id: string; username: string; created_at: number; last_login_at: number | null }>(
    "SELECT id, username, created_at, last_login_at FROM users WHERE id = ?",
    userId
  );
  if (!row) return null;
  return { id: row.id, username: row.username, createdAt: row.created_at, lastLoginAt: row.last_login_at };
};

export const createUser = async (username: string): Promise<User> => {
  const id = randomUUID();
  const now = Math.floor(Date.now() / 1000);
  await state.db.run(
    "INSERT INTO users (id, username, created_at, last_login_at) VALUES (?, ?, ?, ?)",
    id, username, now, now
  );
  return { id, username, createdAt: now, lastLoginAt: now };
};

export const updateUserLastLogin = async (userId: string): Promise<void> => {
  const now = Math.floor(Date.now() / 1000);
  await state.db.run("UPDATE users SET last_login_at = ? WHERE id = ?", now, userId);
};

export const findSessionByToken = async (token: string): Promise<Session | null> => {
  const row = await state.db.get<{ token: string; user_id: string; created_at: number; last_seen_at: number | null; lobby_id: string | null }>(
    "SELECT token, user_id, created_at, last_seen_at, lobby_id FROM sessions WHERE token = ?",
    token
  );
  if (!row) return null;
  return { token: row.token, userId: row.user_id, createdAt: row.created_at, lastSeenAt: row.last_seen_at, lobbyId: row.lobby_id };
};

export const createSession = async (userId: string, lobbyId: string | null = null): Promise<Session> => {
  const token = randomUUID();
  const now = Math.floor(Date.now() / 1000);
  await state.db.run(
    "INSERT INTO sessions (token, user_id, created_at, last_seen_at, lobby_id) VALUES (?, ?, ?, ?, ?)",
    token, userId, now, now, lobbyId
  );
  return { token, userId, createdAt: now, lastSeenAt: now, lobbyId };
};

export const updateSessionLastSeen = async (token: string, lobbyId?: string | null): Promise<void> => {
  const now = Math.floor(Date.now() / 1000);
  if (lobbyId !== undefined) {
    await state.db.run("UPDATE sessions SET last_seen_at = ?, lobby_id = ? WHERE token = ?", now, lobbyId, token);
  } else {
    await state.db.run("UPDATE sessions SET last_seen_at = ? WHERE token = ?", now, token);
  }
};

export const deleteSession = async (token: string): Promise<void> => {
  await state.db.run("DELETE FROM sessions WHERE token = ?", token);
};

export const deleteUserSessions = async (userId: string): Promise<void> => {
  await state.db.run("DELETE FROM sessions WHERE user_id = ?", userId);
};

export const loadCharacterById = async (characterId: string): Promise<CharacterSheet | null> => {
  const row = await state.db.get<{ data: string }>("SELECT data FROM characters WHERE id = ?", characterId);
  if (!row) return null;
  return JSON.parse(row.data) as CharacterSheet;
};

export const upsertCharacter = async (character: CharacterSheet) => {
  await state.db.run(
    "INSERT OR REPLACE INTO characters (id, name, data) VALUES (?, ?, ?)",
    character.id,
    character.name,
    JSON.stringify(character)
  );
};

export const upsertPlayerProfile = async (player: Player, lobbyId: string | null) => {
  await state.db.run(
    "INSERT OR REPLACE INTO players (id, name, character_id, lobby_id, is_bot) VALUES (?, ?, ?, ?, ?)",
    player.id,
    player.name,
    player.characterId || null,
    lobbyId,
    player.isBot ? 1 : 0
  );
};

export const upsertLobby = async (lobby: Lobby) => {
  await state.db.run(
    "INSERT OR REPLACE INTO lobbies (id, name, max_players, status, players_json) VALUES (?, ?, ?, ?, ?)",
    lobby.id,
    lobby.name,
    lobby.maxPlayers,
    lobby.status,
    JSON.stringify(lobby.players)
  );
};

export const deleteLobby = async (lobbyId: string) => {
  await state.db.run("DELETE FROM lobbies WHERE id = ?", lobbyId);
  await state.db.run("DELETE FROM matches WHERE lobby_id = ?", lobbyId);
};

export const upsertMatch = async (lobbyId: string, matchState: MatchState) => {
  await state.db.run(
    "INSERT OR REPLACE INTO matches (lobby_id, state_json) VALUES (?, ?)",
    lobbyId,
    JSON.stringify(matchState)
  );
};

export const loadPersistedData = async () => {
  const characterRows = await state.db.all("SELECT id, data FROM characters") as CharacterRow[];
  const characterMap = new Map<string, CharacterSheet>();
  for (const row of characterRows) {
    try {
      const character = JSON.parse(row.data) as CharacterSheet;
      characterMap.set(row.id, character);
    } catch {
      continue;
    }
  }

  const playerRows = await state.db.all(
    "SELECT id, name, character_id, lobby_id, is_bot FROM players"
  ) as PlayerRow[];
  for (const row of playerRows) {
    const id = row.id ?? randomUUID();
    const characterId = row.character_id ?? "";
    const player: Player = {
      id,
      name: row.name,
      isBot: row.is_bot === 1,
      characterId,
    };
    state.players.set(id, player);
    if (!row.id) {
      await state.db.run("UPDATE players SET id = ? WHERE name = ?", id, row.name);
    }
    if (characterId && characterMap.has(characterId)) {
      state.playerCharacters.set(id, characterMap.get(characterId)!);
    }
  }

  const lobbyRows = await state.db.all("SELECT id, name, max_players, status, players_json FROM lobbies") as LobbyRow[];
  for (const row of lobbyRows) {
    let lobbyPlayers: Player[] = [];
    if (row.players_json) {
      try {
        const storedPlayers = JSON.parse(row.players_json) as Player[];
        lobbyPlayers = storedPlayers.map((stored) => {
          const existing = stored.id ? state.players.get(stored.id) : undefined;
          if (existing) return existing;
          const fallback: Player = {
            id: stored.id || randomUUID(),
            name: stored.name,
            isBot: stored.isBot ?? false,
            characterId: stored.characterId ?? "",
          };
          state.players.set(fallback.id, fallback);
          return fallback;
        });
      } catch {
        lobbyPlayers = [];
      }
    }
    state.lobbies.set(row.id, {
      id: row.id,
      name: row.name,
      maxPlayers: row.max_players,
      status: row.status,
      players: lobbyPlayers,
    });
  }

  const matchRows = await state.db.all("SELECT lobby_id, state_json FROM matches") as MatchRow[];
  for (const row of matchRows) {
    try {
      const matchState = JSON.parse(row.state_json) as MatchState;
      const updatedPlayers = matchState.players.map((p) => state.players.get(p.id) ?? p);
      state.matches.set(row.lobby_id, { ...matchState, players: updatedPlayers });
    } catch {
      continue;
    }
  }

  const botPlayers = Array.from(state.players.values()).filter((player) => player.isBot);
  state.botCount = botPlayers.length + 1;
};

export const persistLobbyState = async (lobby: Lobby) => {
  await upsertLobby(lobby);
  for (const player of lobby.players) {
    await upsertPlayerProfile(player, lobby.id);
  }
};
