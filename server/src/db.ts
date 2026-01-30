import path from "node:path";
import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";
import type { CharacterSheet, MatchState, User, MatchSummary, RulesetId } from "../../shared/types";
import type { BetterSqliteDatabase, CharacterRow, MatchRow, MatchMemberRow, UserRow, SessionRow } from "./types";
import { state } from "./state";
import { assertRulesetId } from "../../shared/rulesets/defaults";

const DB_PATH = path.join(process.cwd(), "data.sqlite");

const generateShortCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

export const initializeDatabase = (): BetterSqliteDatabase => {
  const db = new Database(DB_PATH);
  
  db.exec(`
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
      ruleset_id TEXT NOT NULL DEFAULT 'gurps',
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

  const matchColumns = db.prepare("PRAGMA table_info(matches)").all() as { name: string }[];
  const hasRulesetId = matchColumns.some((column) => column.name === 'ruleset_id');
  if (!hasRulesetId) {
    db.exec("ALTER TABLE matches ADD COLUMN ruleset_id TEXT NOT NULL DEFAULT 'gurps'");
  }

  // Migration: Ensure all matches have a valid rulesetId (set NULL values to 'gurps')
  db.exec(`
    UPDATE matches 
    SET ruleset_id = 'gurps' 
    WHERE ruleset_id IS NULL;
  `);

  // Migration: Add is_favorite column to characters table
  const characterColumns = db.prepare("PRAGMA table_info(characters)").all() as { name: string }[];
  const hasIsFavorite = characterColumns.some((column) => column.name === 'is_favorite');
  if (!hasIsFavorite) {
    db.exec("ALTER TABLE characters ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0");
  }

  // Migration: Add is_public column to matches table
  const hasIsPublic = matchColumns.some((column) => column.name === 'is_public');
  if (!hasIsPublic) {
    db.exec("ALTER TABLE matches ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0");
  }

  return db;
};

export type Session = {
  token: string;
  userId: string;
  createdAt: number;
  lastSeenAt: number | null;
};

export const findUserByUsername = (username: string): User | null => {
  const row = state.db.prepare(
    "SELECT id, username, is_bot FROM users WHERE username = ?"
  ).get(username) as UserRow | undefined;
  if (!row) return null;
  return { id: row.id, username: row.username, isBot: row.is_bot === 1 };
};

export const findUserById = (userId: string): User | null => {
  const row = state.db.prepare(
    "SELECT id, username, is_bot FROM users WHERE id = ?"
  ).get(userId) as UserRow | undefined;
  if (!row) return null;
  return { id: row.id, username: row.username, isBot: row.is_bot === 1 };
};

export const createUser = (username: string, isBot = false): User => {
  const id = randomUUID();
  state.db.prepare(
    "INSERT INTO users (id, username, is_bot) VALUES (?, ?, ?)"
  ).run(id, username, isBot ? 1 : 0);
  return { id, username, isBot };
};

export const findSessionByToken = (token: string): Session | null => {
  const row = state.db.prepare(
    "SELECT token, user_id, created_at, last_seen_at FROM sessions WHERE token = ?"
  ).get(token) as SessionRow | undefined;
  if (!row) return null;
  return { token: row.token, userId: row.user_id, createdAt: row.created_at, lastSeenAt: row.last_seen_at };
};

export const createSession = (userId: string): Session => {
  const token = randomUUID();
  const now = Math.floor(Date.now() / 1000);
  state.db.prepare(
    "INSERT INTO sessions (token, user_id, created_at, last_seen_at) VALUES (?, ?, ?, ?)"
  ).run(token, userId, now, now);
  return { token, userId, createdAt: now, lastSeenAt: now };
};

export const updateSessionLastSeen = (token: string): void => {
  const now = Math.floor(Date.now() / 1000);
  state.db.prepare("UPDATE sessions SET last_seen_at = ? WHERE token = ?").run(now, token);
};

export const loadCharacterById = (characterId: string): CharacterSheet | null => {
  const row = state.db.prepare(
    "SELECT data_json FROM characters WHERE id = ?"
  ).get(characterId) as CharacterRow | undefined;
  if (!row) return null;
  return JSON.parse(row.data_json) as CharacterSheet;
};

export const loadCharactersByOwner = (ownerId: string): CharacterSheet[] => {
  const rows = state.db.prepare(
    "SELECT data_json, is_favorite FROM characters WHERE owner_id = ?"
  ).all(ownerId) as Array<{ data_json: string; is_favorite: number }>;
  return rows.map(row => {
    const sheet = JSON.parse(row.data_json) as CharacterSheet;
    sheet.isFavorite = Boolean(row.is_favorite);
    return sheet;
  });
};

export const upsertCharacter = (character: CharacterSheet, ownerId: string): void => {
  state.db.prepare(
    "INSERT INTO characters (id, owner_id, name, data_json) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, data_json = excluded.data_json"
  ).run(character.id, ownerId, character.name, JSON.stringify(character));
};

export const createMatch = (name: string, maxPlayers: number, createdBy: string, rulesetId: string, isPublic = false): { id: string; code: string } => {
  const id = randomUUID();
  let code = generateShortCode();
  
  let attempts = 0;
  while (attempts < 10) {
    const existing = state.db.prepare("SELECT id FROM matches WHERE code = ?").get(code);
    if (!existing) break;
    code = generateShortCode();
    attempts++;
  }
  
  const now = Math.floor(Date.now() / 1000);
  state.db.prepare(
    "INSERT INTO matches (id, code, name, max_players, status, created_by, ruleset_id, is_public, created_at) VALUES (?, ?, ?, ?, 'waiting', ?, ?, ?, ?)"
  ).run(id, code, name, maxPlayers, createdBy, rulesetId, isPublic ? 1 : 0, now);
  
  return { id, code };
};

export const findMatchByCode = (code: string): MatchRow | null => {
  const row = state.db.prepare(
    "SELECT id, code, name, max_players, status, state_json, created_by, winner_id, ruleset_id, created_at, finished_at FROM matches WHERE code = ?"
  ).get(code.toUpperCase()) as MatchRow | undefined;
  return row ?? null;
};

export const findMatchById = (matchId: string): MatchRow | null => {
  const row = state.db.prepare(
    "SELECT id, code, name, max_players, status, state_json, created_by, winner_id, ruleset_id, created_at, finished_at FROM matches WHERE id = ?"
  ).get(matchId) as MatchRow | undefined;
  return row ?? null;
};

export const updateMatchState = (matchId: string, matchState: MatchState): void => {
  state.db.prepare(
    "UPDATE matches SET status = ?, state_json = ?, winner_id = ?, finished_at = ? WHERE id = ?"
  ).run(
    matchState.status,
    JSON.stringify(matchState),
    matchState.winnerId ?? null,
    matchState.finishedAt ?? null,
    matchId
  );
};

export const updateMatchStatus = (matchId: string, status: string): void => {
  state.db.prepare("UPDATE matches SET status = ? WHERE id = ?").run(status, matchId);
};

export const addMatchMember = (matchId: string, userId: string, characterId: string | null): void => {
  state.db.prepare(
    "INSERT OR REPLACE INTO match_members (match_id, user_id, character_id, is_connected) VALUES (?, ?, ?, 1)"
  ).run(matchId, userId, characterId);
};

export const updateMatchMemberConnection = (matchId: string, userId: string, isConnected: boolean): void => {
  state.db.prepare(
    "UPDATE match_members SET is_connected = ? WHERE match_id = ? AND user_id = ?"
  ).run(isConnected ? 1 : 0, matchId, userId);
};

export const updateMatchMemberCharacter = (matchId: string, userId: string, characterId: string): void => {
  state.db.prepare(
    "UPDATE match_members SET character_id = ? WHERE match_id = ? AND user_id = ?"
  ).run(characterId, matchId, userId);
};

export const getMatchMembers = (matchId: string): MatchMemberRow[] => {
  return state.db.prepare(
    "SELECT match_id, user_id, character_id, is_connected, joined_at FROM match_members WHERE match_id = ?"
  ).all(matchId) as MatchMemberRow[];
};

export const getMatchMember = (matchId: string, userId: string): MatchMemberRow | null => {
  const row = state.db.prepare(
    "SELECT match_id, user_id, character_id, is_connected, joined_at FROM match_members WHERE match_id = ? AND user_id = ?"
  ).get(matchId, userId) as MatchMemberRow | undefined;
  return row ?? null;
};

export const getUserMatches = (userId: string): MatchRow[] => {
  return state.db.prepare(
    `SELECT m.id, m.code, m.name, m.max_players, m.status, m.state_json, m.created_by, m.winner_id, m.ruleset_id, m.created_at, m.finished_at
     FROM matches m
     INNER JOIN match_members mm ON m.id = mm.match_id
     WHERE mm.user_id = ?
     ORDER BY m.created_at DESC`
  ).all(userId) as MatchRow[];
};

export const removeMatchMember = (matchId: string, userId: string): void => {
  state.db.prepare(
    "DELETE FROM match_members WHERE match_id = ? AND user_id = ?"
  ).run(matchId, userId);
};

export const getMatchMemberCount = (matchId: string): number => {
  const result = state.db.prepare(
    "SELECT COUNT(*) as count FROM match_members WHERE match_id = ?"
  ).get(matchId) as { count: number } | undefined;
  return result?.count ?? 0;
};

export const countActiveMatchesForCharacter = (characterId: string): number => {
  const result = state.db.prepare(`
    SELECT COUNT(*) as count
    FROM match_members mm
    INNER JOIN matches m ON mm.match_id = m.id
    WHERE mm.character_id = ? AND m.status IN ('active', 'paused')
  `).get(characterId) as { count: number };
  return result.count;
};

export const clearCharacterFromWaitingMatches = (characterId: string): void => {
  state.db.prepare(`
    UPDATE match_members SET character_id = NULL
    WHERE character_id = ?
    AND match_id IN (SELECT id FROM matches WHERE status = 'waiting')
  `).run(characterId);
};

export const clearDefaultCharacter = (characterId: string): void => {
  state.db.prepare(`
    UPDATE users SET default_character_id = NULL WHERE default_character_id = ?
  `).run(characterId);
};

export const deleteCharacter = (characterId: string, ownerId: string): void => {
  state.db.prepare(`
    DELETE FROM characters WHERE id = ? AND owner_id = ?
  `).run(characterId, ownerId);
};

export const getPublicWaitingMatches = (): MatchRow[] => {
  return state.db.prepare(`
    SELECT * FROM matches WHERE is_public = 1 AND status = 'waiting' ORDER BY created_at DESC
  `).all() as MatchRow[];
};

export const getReadyPlayers = (matchId: string): string[] => {
  return Array.from(state.readySets.get(matchId) ?? []);
};

export const buildJoinableMatchSummary = (matchRow: MatchRow, forUserId: string): MatchSummary => {
  const members = getMatchMembers(matchRow.id);
  const players: { id: string; name: string; isConnected: boolean }[] = [];
  
  for (const member of members) {
    const user = findUserById(member.user_id);
    if (user) {
      players.push({
        id: user.id,
        name: user.username,
        isConnected: member.is_connected === 1
      });
    }
  }
  
  const readyPlayers = getReadyPlayers(matchRow.id);
  
  return {
    id: matchRow.id,
    code: matchRow.code,
    name: matchRow.name,
    creatorId: matchRow.created_by,
    playerCount: members.length,
    maxPlayers: matchRow.max_players,
    rulesetId: assertRulesetId(matchRow.ruleset_id as unknown as RulesetId | undefined),
    status: matchRow.status as MatchSummary['status'],
    players,
    isMyTurn: false,
    readyPlayers,
  };
};

export const buildMatchSummary = (matchRow: MatchRow, forUserId: string): MatchSummary => {
  const members = getMatchMembers(matchRow.id);
  const players: { id: string; name: string; isConnected: boolean }[] = [];
  
  let activeTurnPlayerId: string | null = null;
  if (matchRow.state_json) {
    try {
       const matchState = JSON.parse(matchRow.state_json) as MatchState;
       activeTurnPlayerId = matchState.activeTurnPlayerId;
     } catch {
       // Ignore JSON parse errors
     }
  }
  
  for (const member of members) {
    const user = findUserById(member.user_id);
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
    const winner = findUserById(matchRow.winner_id);
    winnerName = winner?.username;
  }
  
  return {
    id: matchRow.id,
    code: matchRow.code,
    name: matchRow.name,
    creatorId: matchRow.created_by,
    playerCount: members.length,
    maxPlayers: matchRow.max_players,
    rulesetId: assertRulesetId(matchRow.ruleset_id as unknown as RulesetId | undefined),
    status: matchRow.status as MatchSummary["status"],
    players,
    isMyTurn: activeTurnPlayerId === forUserId,
    winnerId: matchRow.winner_id ?? undefined,
    winnerName
  };
};

export const loadPersistedMatches = (): void => {
  const rows = state.db.prepare(
    "SELECT id, code, name, max_players, status, state_json, created_by, winner_id, ruleset_id, created_at, finished_at FROM matches WHERE status IN ('waiting', 'active', 'paused')"
  ).all() as MatchRow[];
  
  for (const row of rows) {
    if (row.state_json) {
       try {
         const matchState = JSON.parse(row.state_json) as MatchState;
         state.matches.set(row.id, matchState);
       } catch {
         // Ignore JSON parse errors
       }
    }
  }
};

export const loadPersistedUsers = (): void => {
  const rows = state.db.prepare("SELECT id, username, is_bot FROM users").all() as UserRow[];
  for (const row of rows) {
    state.users.set(row.id, { id: row.id, username: row.username, isBot: row.is_bot === 1 });
  }
};

export const loadPersistedCharacters = (): void => {
  const rows = state.db.prepare("SELECT id, data_json FROM characters").all() as CharacterRow[];
  for (const row of rows) {
     try {
       const character = JSON.parse(row.data_json) as CharacterSheet;
       state.characters.set(row.id, character);
     } catch {
       // Ignore JSON parse errors
     }
  }
};

export const loadPersistedData = (): void => {
  loadPersistedUsers();
  loadPersistedCharacters();
  loadPersistedMatches();
  
  const botUsers = Array.from(state.users.values()).filter(u => u.isBot);
  state.botCount = botUsers.length + 1;
};

export const getActiveMatches = (): MatchRow[] => {
  return state.db.prepare(
    "SELECT id, code, name, max_players, status, state_json, created_by, winner_id, ruleset_id, created_at, finished_at FROM matches WHERE status IN ('active', 'paused')"
  ).all() as MatchRow[];
};

export const buildPublicMatchSummary = (matchRow: MatchRow): MatchSummary => {
  const members = getMatchMembers(matchRow.id);
  const players: { id: string; name: string; isConnected: boolean }[] = [];
  
  for (const member of members) {
    const user = findUserById(member.user_id);
    if (user) {
      players.push({
        id: user.id,
        name: user.username,
        isConnected: member.is_connected === 1
      });
    }
  }
  
  return {
    id: matchRow.id,
    code: '',
    name: matchRow.name,
    creatorId: matchRow.created_by,
    playerCount: members.length,
    maxPlayers: matchRow.max_players,
    rulesetId: assertRulesetId(matchRow.ruleset_id as unknown as RulesetId | undefined),
    status: matchRow.status as MatchSummary['status'],
    players,
    isMyTurn: false,
  };
};
