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
