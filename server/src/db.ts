import path from "node:path";
import { randomUUID } from "node:crypto";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import type { CharacterSheet, MatchState, User, MatchSummary } from "../../shared/types";
import type { SqliteDatabase, CharacterRow, MatchRow, MatchMemberRow, UserRow, SessionRow } from "./types";
import { state } from "./state";

const DB_PATH = path.join(process.cwd(), "data.sqlite");

const generateShortCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

export const initializeDatabase = async (): Promise<SqliteDatabase> => {
  const db = await open({ filename: DB_PATH, driver: sqlite3.Database });
  
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      is_bot INTEGER DEFAULT 0,
      default_character_id TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    );
    
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      last_seen_at INTEGER,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    
    CREATE TABLE IF NOT EXISTS characters (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      name TEXT NOT NULL,
      data_json TEXT NOT NULL,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (owner_id) REFERENCES users(id)
    );
    
    CREATE TABLE IF NOT EXISTS matches (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      max_players INTEGER NOT NULL DEFAULT 2,
      status TEXT NOT NULL DEFAULT 'waiting',
      state_json TEXT,
      created_by TEXT NOT NULL,
      winner_id TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      finished_at INTEGER,
      FOREIGN KEY (created_by) REFERENCES users(id),
      FOREIGN KEY (winner_id) REFERENCES users(id)
    );
    
    CREATE TABLE IF NOT EXISTS match_members (
      match_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      character_id TEXT,
      is_connected INTEGER DEFAULT 1,
      joined_at INTEGER DEFAULT (strftime('%s', 'now')),
      PRIMARY KEY (match_id, user_id),
      FOREIGN KEY (match_id) REFERENCES matches(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (character_id) REFERENCES characters(id)
    );
    
    CREATE INDEX IF NOT EXISTS idx_match_members_user ON match_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);
    CREATE INDEX IF NOT EXISTS idx_matches_code ON matches(code);
  `);

  return db;
};

export type Session = {
  token: string;
  userId: string;
  createdAt: number;
  lastSeenAt: number | null;
};

export const findUserByUsername = async (username: string): Promise<User | null> => {
  const row = await state.db.get<UserRow>(
    "SELECT id, username, is_bot FROM users WHERE username = ?",
    username
  );
  if (!row) return null;
  return { id: row.id, username: row.username, isBot: row.is_bot === 1 };
};

export const findUserById = async (userId: string): Promise<User | null> => {
  const row = await state.db.get<UserRow>(
    "SELECT id, username, is_bot FROM users WHERE id = ?",
    userId
  );
  if (!row) return null;
  return { id: row.id, username: row.username, isBot: row.is_bot === 1 };
};

export const createUser = async (username: string, isBot = false): Promise<User> => {
  const id = randomUUID();
  await state.db.run(
    "INSERT INTO users (id, username, is_bot) VALUES (?, ?, ?)",
    id, username, isBot ? 1 : 0
  );
  return { id, username, isBot };
};

export const findSessionByToken = async (token: string): Promise<Session | null> => {
  const row = await state.db.get<SessionRow>(
    "SELECT token, user_id, created_at, last_seen_at FROM sessions WHERE token = ?",
    token
  );
  if (!row) return null;
  return { token: row.token, userId: row.user_id, createdAt: row.created_at, lastSeenAt: row.last_seen_at };
};

export const createSession = async (userId: string): Promise<Session> => {
  const token = randomUUID();
  const now = Math.floor(Date.now() / 1000);
  await state.db.run(
    "INSERT INTO sessions (token, user_id, created_at, last_seen_at) VALUES (?, ?, ?, ?)",
    token, userId, now, now
  );
  return { token, userId, createdAt: now, lastSeenAt: now };
};

export const updateSessionLastSeen = async (token: string): Promise<void> => {
  const now = Math.floor(Date.now() / 1000);
  await state.db.run("UPDATE sessions SET last_seen_at = ? WHERE token = ?", now, token);
};

export const loadCharacterById = async (characterId: string): Promise<CharacterSheet | null> => {
  const row = await state.db.get<CharacterRow>(
    "SELECT data_json FROM characters WHERE id = ?",
    characterId
  );
  if (!row) return null;
  return JSON.parse(row.data_json) as CharacterSheet;
};

export const loadCharactersByOwner = async (ownerId: string): Promise<CharacterSheet[]> => {
  const rows = await state.db.all<CharacterRow[]>(
    "SELECT data_json FROM characters WHERE owner_id = ?",
    ownerId
  );
  return rows.map(row => JSON.parse(row.data_json) as CharacterSheet);
};

export const upsertCharacter = async (character: CharacterSheet, ownerId: string): Promise<void> => {
  await state.db.run(
    "INSERT OR REPLACE INTO characters (id, owner_id, name, data_json) VALUES (?, ?, ?, ?)",
    character.id, ownerId, character.name, JSON.stringify(character)
  );
};

export const createMatch = async (name: string, maxPlayers: number, createdBy: string): Promise<{ id: string; code: string }> => {
  const id = randomUUID();
  let code = generateShortCode();
  
  let attempts = 0;
  while (attempts < 10) {
    const existing = await state.db.get("SELECT id FROM matches WHERE code = ?", code);
    if (!existing) break;
    code = generateShortCode();
    attempts++;
  }
  
  const now = Math.floor(Date.now() / 1000);
  await state.db.run(
    "INSERT INTO matches (id, code, name, max_players, status, created_by, created_at) VALUES (?, ?, ?, ?, 'waiting', ?, ?)",
    id, code, name, maxPlayers, createdBy, now
  );
  
  return { id, code };
};

export const findMatchByCode = async (code: string): Promise<MatchRow | null> => {
  const row = await state.db.get<MatchRow>(
    "SELECT id, code, name, max_players, status, state_json, created_by, winner_id, created_at, finished_at FROM matches WHERE code = ?",
    code.toUpperCase()
  );
  return row ?? null;
};

export const findMatchById = async (matchId: string): Promise<MatchRow | null> => {
  const row = await state.db.get<MatchRow>(
    "SELECT id, code, name, max_players, status, state_json, created_by, winner_id, created_at, finished_at FROM matches WHERE id = ?",
    matchId
  );
  return row ?? null;
};

export const updateMatchState = async (matchId: string, matchState: MatchState): Promise<void> => {
  await state.db.run(
    "UPDATE matches SET status = ?, state_json = ?, winner_id = ?, finished_at = ? WHERE id = ?",
    matchState.status,
    JSON.stringify(matchState),
    matchState.winnerId ?? null,
    matchState.finishedAt ?? null,
    matchId
  );
};

export const updateMatchStatus = async (matchId: string, status: string): Promise<void> => {
  await state.db.run("UPDATE matches SET status = ? WHERE id = ?", status, matchId);
};

export const addMatchMember = async (matchId: string, userId: string, characterId: string | null): Promise<void> => {
  await state.db.run(
    "INSERT OR REPLACE INTO match_members (match_id, user_id, character_id, is_connected) VALUES (?, ?, ?, 1)",
    matchId, userId, characterId
  );
};

export const updateMatchMemberConnection = async (matchId: string, userId: string, isConnected: boolean): Promise<void> => {
  await state.db.run(
    "UPDATE match_members SET is_connected = ? WHERE match_id = ? AND user_id = ?",
    isConnected ? 1 : 0, matchId, userId
  );
};

export const updateMatchMemberCharacter = async (matchId: string, userId: string, characterId: string): Promise<void> => {
  await state.db.run(
    "UPDATE match_members SET character_id = ? WHERE match_id = ? AND user_id = ?",
    characterId, matchId, userId
  );
};

export const getMatchMembers = async (matchId: string): Promise<MatchMemberRow[]> => {
  return state.db.all<MatchMemberRow[]>(
    "SELECT match_id, user_id, character_id, is_connected, joined_at FROM match_members WHERE match_id = ?",
    matchId
  );
};

export const getMatchMember = async (matchId: string, userId: string): Promise<MatchMemberRow | null> => {
  const row = await state.db.get<MatchMemberRow>(
    "SELECT match_id, user_id, character_id, is_connected, joined_at FROM match_members WHERE match_id = ? AND user_id = ?",
    matchId, userId
  );
  return row ?? null;
};

export const getUserMatches = async (userId: string): Promise<MatchRow[]> => {
  return state.db.all<MatchRow[]>(
    `SELECT m.id, m.code, m.name, m.max_players, m.status, m.state_json, m.created_by, m.winner_id, m.created_at, m.finished_at
     FROM matches m
     INNER JOIN match_members mm ON m.id = mm.match_id
     WHERE mm.user_id = ?
     ORDER BY m.created_at DESC`,
    userId
  );
};

export const removeMatchMember = async (matchId: string, userId: string): Promise<void> => {
  await state.db.run(
    "DELETE FROM match_members WHERE match_id = ? AND user_id = ?",
    matchId, userId
  );
};

export const getMatchMemberCount = async (matchId: string): Promise<number> => {
  const result = await state.db.get<{ count: number }>(
    "SELECT COUNT(*) as count FROM match_members WHERE match_id = ?",
    matchId
  );
  return result?.count ?? 0;
};

export const buildMatchSummary = async (matchRow: MatchRow, forUserId: string): Promise<MatchSummary> => {
  const members = await getMatchMembers(matchRow.id);
  const players: { id: string; name: string; isConnected: boolean }[] = [];
  
  let activeTurnPlayerId: string | null = null;
  if (matchRow.state_json) {
    try {
      const matchState = JSON.parse(matchRow.state_json) as MatchState;
      activeTurnPlayerId = matchState.activeTurnPlayerId;
    } catch {}
  }
  
  for (const member of members) {
    const user = await findUserById(member.user_id);
    if (user) {
      players.push({
        id: user.id,
        name: user.username,
        isConnected: member.is_connected === 1
      });
    }
  }
  
  let winnerName: string | undefined;
  if (matchRow.winner_id) {
    const winner = await findUserById(matchRow.winner_id);
    winnerName = winner?.username;
  }
  
  return {
    id: matchRow.id,
    code: matchRow.code,
    name: matchRow.name,
    playerCount: members.length,
    maxPlayers: matchRow.max_players,
    status: matchRow.status as MatchSummary["status"],
    players,
    isMyTurn: activeTurnPlayerId === forUserId,
    winnerId: matchRow.winner_id ?? undefined,
    winnerName
  };
};

export const loadPersistedMatches = async (): Promise<void> => {
  const rows = await state.db.all<MatchRow[]>(
    "SELECT id, code, name, max_players, status, state_json, created_by, winner_id, created_at, finished_at FROM matches WHERE status IN ('waiting', 'active', 'paused')"
  );
  
  for (const row of rows) {
    if (row.state_json) {
      try {
        const matchState = JSON.parse(row.state_json) as MatchState;
        state.matches.set(row.id, matchState);
      } catch {}
    }
  }
};

export const loadPersistedUsers = async (): Promise<void> => {
  const rows = await state.db.all<UserRow[]>("SELECT id, username, is_bot FROM users");
  for (const row of rows) {
    state.users.set(row.id, { id: row.id, username: row.username, isBot: row.is_bot === 1 });
  }
};

export const loadPersistedCharacters = async (): Promise<void> => {
  const rows = await state.db.all<CharacterRow[]>("SELECT id, data_json FROM characters");
  for (const row of rows) {
    try {
      const character = JSON.parse(row.data_json) as CharacterSheet;
      state.characters.set(row.id, character);
    } catch {}
  }
};

export const loadPersistedData = async (): Promise<void> => {
  await loadPersistedUsers();
  await loadPersistedCharacters();
  await loadPersistedMatches();
  
  const botUsers = Array.from(state.users.values()).filter(u => u.isBot);
  state.botCount = botUsers.length + 1;
};
