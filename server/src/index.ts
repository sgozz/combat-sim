import http from "node:http";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { WebSocket, WebSocketServer } from "ws";
import sqlite3 from "sqlite3";
import { open, type Database } from "sqlite";
import type {
  CharacterSheet,
  ClientToServerMessage,
  CombatantState,
  LobbySummary,
  MatchState,
  Player,
  ServerToClientMessage,
} from "../../shared/types";
import { advanceTurn, calculateDerivedStats } from "../../shared/rules";

const PORT = Number(process.env.PORT ?? 8080);
const DB_PATH = path.join(process.cwd(), "data.sqlite");

type SqliteDatabase = Database<sqlite3.Database, sqlite3.Statement>;

type Lobby = {
  id: string;
  name: string;
  maxPlayers: number;
  players: Player[];
  status: "open" | "in_match";
};

type ConnectionState = {
  playerId?: string;
  lobbyId?: string;
};

type PlayerRow = {
  id: string | null;
  name: string;
  character_id: string | null;
  lobby_id: string | null;
  is_bot: number | null;
};

type LobbyRow = {
  id: string;
  name: string;
  max_players: number;
  status: "open" | "in_match";
  players_json: string | null;
};

type MatchRow = {
  lobby_id: string;
  state_json: string;
};

type CharacterRow = {
  id: string;
  data: string;
};

const players = new Map<string, Player>();
const playerCharacters = new Map<string, CharacterSheet>();
const lobbies = new Map<string, Lobby>();
const connections = new Map<WebSocket, ConnectionState>();
const matches = new Map<string, MatchState>();
const botTimers = new Map<string, NodeJS.Timeout>();
let botCount = 1;
let db: SqliteDatabase;

const server = http.createServer((_, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ status: "ok" }));
});

const wss = new WebSocketServer({ server });

const sendMessage = (socket: WebSocket, message: ServerToClientMessage) => {
  socket.send(JSON.stringify(message));
};

const broadcast = (message: ServerToClientMessage) => {
  for (const socket of wss.clients) {
    if (socket.readyState === WebSocket.OPEN) {
      sendMessage(socket, message);
    }
  }
};

const summarizeLobby = (lobby: Lobby): LobbySummary => ({
  id: lobby.id,
  name: lobby.name,
  playerCount: lobby.players.length,
  maxPlayers: lobby.maxPlayers,
  status: lobby.status,
});

const broadcastLobbies = () => {
  const lobbiesSummary = Array.from(lobbies.values()).map(summarizeLobby);
  broadcast({ type: "lobbies", lobbies: lobbiesSummary });
};

const sendToLobby = (lobby: Lobby, message: ServerToClientMessage) => {
  const lobbyPlayerIds = new Set(lobby.players.map((player) => player.id));
  for (const [socket, state] of connections.entries()) {
    if (state.playerId && lobbyPlayerIds.has(state.playerId)) {
      sendMessage(socket, message);
    }
  }
};

const initializeDatabase = async () => {
  db = await open({ filename: DB_PATH, driver: sqlite3.Database });
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

  const playerColumns = await db.all<{ name: string }>("PRAGMA table_info(players)");
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

  const missingIds = await db.all<{ name: string }>("SELECT name FROM players WHERE id IS NULL");
  for (const row of missingIds) {
    await db.run("UPDATE players SET id = ? WHERE name = ?", randomUUID(), row.name);
  }
};

const loadCharacterById = async (characterId: string): Promise<CharacterSheet | null> => {
  const row = await db.get<{ data: string }>("SELECT data FROM characters WHERE id = ?", characterId);
  if (!row) return null;
  return JSON.parse(row.data) as CharacterSheet;
};

const upsertCharacter = async (character: CharacterSheet) => {
  await db.run(
    "INSERT OR REPLACE INTO characters (id, name, data) VALUES (?, ?, ?)",
    character.id,
    character.name,
    JSON.stringify(character)
  );
};

const upsertPlayerProfile = async (player: Player, lobbyId: string | null) => {
  await db.run(
    "INSERT OR REPLACE INTO players (id, name, character_id, lobby_id, is_bot) VALUES (?, ?, ?, ?, ?)",
    player.id,
    player.name,
    player.characterId || null,
    lobbyId,
    player.isBot ? 1 : 0
  );
};

const upsertLobby = async (lobby: Lobby) => {
  await db.run(
    "INSERT OR REPLACE INTO lobbies (id, name, max_players, status, players_json) VALUES (?, ?, ?, ?, ?)",
    lobby.id,
    lobby.name,
    lobby.maxPlayers,
    lobby.status,
    JSON.stringify(lobby.players)
  );
};

const deleteLobby = async (lobbyId: string) => {
  await db.run("DELETE FROM lobbies WHERE id = ?", lobbyId);
  await db.run("DELETE FROM matches WHERE lobby_id = ?", lobbyId);
};

const upsertMatch = async (lobbyId: string, state: MatchState) => {
  await db.run(
    "INSERT OR REPLACE INTO matches (lobby_id, state_json) VALUES (?, ?)",
    lobbyId,
    JSON.stringify(state)
  );
};

const loadPersistedData = async () => {
  const characterRows = await db.all<CharacterRow>("SELECT id, data FROM characters");
  const characterMap = new Map<string, CharacterSheet>();
  for (const row of characterRows) {
    try {
      const character = JSON.parse(row.data) as CharacterSheet;
      characterMap.set(row.id, character);
    } catch {
      continue;
    }
  }

  const playerRows = await db.all<PlayerRow>(
    "SELECT id, name, character_id, lobby_id, is_bot FROM players"
  );
  for (const row of playerRows) {
    const id = row.id ?? randomUUID();
    const characterId = row.character_id ?? "";
    const player: Player = {
      id,
      name: row.name,
      isBot: row.is_bot === 1,
      characterId,
    };
    players.set(id, player);
    if (!row.id) {
      await db.run("UPDATE players SET id = ? WHERE name = ?", id, row.name);
    }
    if (characterId && characterMap.has(characterId)) {
      playerCharacters.set(id, characterMap.get(characterId)!);
    }
  }

  const lobbyRows = await db.all<LobbyRow>("SELECT id, name, max_players, status, players_json FROM lobbies");
  for (const row of lobbyRows) {
    let lobbyPlayers: Player[] = [];
    if (row.players_json) {
      try {
        const storedPlayers = JSON.parse(row.players_json) as Player[];
        lobbyPlayers = storedPlayers.map((stored) => {
          const existing = stored.id ? players.get(stored.id) : undefined;
          if (existing) return existing;
          const fallback: Player = {
            id: stored.id || randomUUID(),
            name: stored.name,
            isBot: stored.isBot ?? false,
            characterId: stored.characterId ?? "",
          };
          players.set(fallback.id, fallback);
          return fallback;
        });
      } catch {
        lobbyPlayers = [];
      }
    }
    lobbies.set(row.id, {
      id: row.id,
      name: row.name,
      maxPlayers: row.max_players,
      status: row.status,
      players: lobbyPlayers,
    });
  }

  const matchRows = await db.all<MatchRow>("SELECT lobby_id, state_json FROM matches");
  for (const row of matchRows) {
    try {
      const state = JSON.parse(row.state_json) as MatchState;
      const updatedPlayers = state.players.map((player) => players.get(player.id) ?? player);
      matches.set(row.lobby_id, { ...state, players: updatedPlayers });
    } catch {
      continue;
    }
  }

  const botPlayers = Array.from(players.values()).filter((player) => player.isBot);
  botCount = botPlayers.length + 1;
};

const requirePlayer = (socket: WebSocket): Player | null => {
  const state = connections.get(socket);
  if (!state?.playerId) {
    sendMessage(socket, { type: "error", message: "Authenticate first." });
    return null;
  }
  const player = players.get(state.playerId);
  if (!player) {
    sendMessage(socket, { type: "error", message: "Player not found." });
    return null;
  }
  return player;
};

const persistLobbyState = async (lobby: Lobby) => {
  await upsertLobby(lobby);
  for (const player of lobby.players) {
    await upsertPlayerProfile(player, lobby.id);
  }
};

const leaveLobby = async (socket: WebSocket) => {
  const state = connections.get(socket);
  if (!state?.lobbyId || !state.playerId) {
    return;
  }
  const lobby = lobbies.get(state.lobbyId);
  if (!lobby) {
    connections.set(socket, { playerId: state.playerId });
    return;
  }
  const departingPlayer = lobby.players.find((player) => player.id === state.playerId) ?? null;
  lobby.players = lobby.players.filter((player) => player.id !== state.playerId);
  if (departingPlayer) {
    await upsertPlayerProfile({ ...departingPlayer, characterId: departingPlayer.characterId }, null);
  }
  if (lobby.players.length === 0) {
    lobbies.delete(lobby.id);
    matches.delete(lobby.id);
    await deleteLobby(lobby.id);
  } else {
    await persistLobbyState(lobby);
  }
  connections.set(socket, { playerId: state.playerId });
  broadcastLobbies();
};

const createBotCharacter = (name: string): CharacterSheet => {
  const attributes = {
    strength: 10,
    dexterity: 10,
    intelligence: 9,
    health: 10,
  };
  return {
    id: randomUUID(),
    name,
    attributes,
    derived: calculateDerivedStats(attributes),
    skills: [{ id: randomUUID(), name: "Brawling", level: 12 }],
    advantages: [],
    disadvantages: [],
    equipment: [{ id: randomUUID(), name: "Club", damage: "1d+1" }],
    pointsTotal: 75,
  };
};

const addBotToLobby = async (lobby: Lobby) => {
  const botName = `Bot ${botCount++}`;
  const botPlayer: Player = {
    id: randomUUID(),
    name: botName,
    isBot: true,
    characterId: "",
  };
  const botCharacter = createBotCharacter(botName);
  botPlayer.characterId = botCharacter.id;
  players.set(botPlayer.id, botPlayer);
  playerCharacters.set(botPlayer.id, botCharacter);
  lobby.players.push(botPlayer);
  await upsertCharacter(botCharacter);
  await upsertPlayerProfile(botPlayer, lobby.id);
};

const ensureMinimumBots = async (lobby: Lobby) => {
  while (lobby.players.length < 2) {
    await addBotToLobby(lobby);
  }
};

const createMatchState = (lobby: Lobby): MatchState => {
  const characters = lobby.players.map((player) => {
    const existing = playerCharacters.get(player.id);
    if (existing) return existing;
    const attributes = {
      strength: 10,
      dexterity: 10,
      intelligence: 10,
      health: 10,
    };
    const fallback: CharacterSheet = {
      id: randomUUID(),
      name: player.name,
      attributes,
      derived: calculateDerivedStats(attributes),
      skills: [],
      advantages: [],
      disadvantages: [],
      equipment: [],
      pointsTotal: 100,
    };
    playerCharacters.set(player.id, fallback);
    player.characterId = fallback.id;
    players.set(player.id, player);
    return fallback;
  });

  const combatants: CombatantState[] = characters.map((character, index) => ({
    playerId: lobby.players[index]?.id ?? character.id,
    characterId: character.id,
    position: { x: index, y: 0, z: 0 },
    currentHP: character.derived.hitPoints,
    currentFP: character.derived.fatiguePoints,
    statusEffects: [],
  }));

  return {
    id: randomUUID(),
    players: lobby.players,
    characters,
    combatants,
    activeTurnPlayerId: lobby.players[0]?.id ?? "",
    round: 1,
    log: ["Match started."],
  };
};

const scheduleBotTurn = (lobby: Lobby, match: MatchState) => {
  const activePlayer = lobby.players.find((player) => player.id === match.activeTurnPlayerId);
  if (!activePlayer?.isBot) {
    return;
  }
  const existingTimer = botTimers.get(lobby.id);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }
  const timer = setTimeout(async () => {
    const currentMatch = matches.get(lobby.id);
    if (!currentMatch) return;
    const updated = advanceTurn({
      ...currentMatch,
      log: [...currentMatch.log, `${activePlayer.name} waits.`],
    });
    matches.set(lobby.id, updated);
    await upsertMatch(lobby.id, updated);
    sendToLobby(lobby, { type: "match_state", state: updated });
    scheduleBotTurn(lobby, updated);
  }, 800);
  botTimers.set(lobby.id, timer);
};

const startServer = async () => {
  await initializeDatabase();
  await loadPersistedData();
  const storedPlayers = await db.get<{ count: number }>("SELECT COUNT(*) as count FROM players");
  const storedCharacters = await db.get<{ count: number }>("SELECT COUNT(*) as count FROM characters");
  console.log(`Loaded ${storedPlayers?.count ?? 0} player profiles and ${storedCharacters?.count ?? 0} characters.`);

  wss.on("connection", (socket) => {
    connections.set(socket, {});
    sendMessage(socket, { type: "lobbies", lobbies: Array.from(lobbies.values()).map(summarizeLobby) });

    socket.on("message", async (data) => {
      let message: ClientToServerMessage;
      try {
        message = JSON.parse(data.toString()) as ClientToServerMessage;
      } catch {
        sendMessage(socket, { type: "error", message: "Invalid message format." });
        return;
      }

      switch (message.type) {
        case "auth": {
          const stored = await db.get<PlayerRow>(
            "SELECT id, name, character_id, lobby_id, is_bot FROM players WHERE name = ?",
            message.name
          );
          const playerId = stored?.id ?? randomUUID();
          const player: Player = {
            id: playerId,
            name: message.name,
            isBot: false,
            characterId: stored?.character_id ?? "",
          };
          if (stored?.character_id) {
            const storedCharacter = await loadCharacterById(stored.character_id);
            if (storedCharacter) {
              player.characterId = storedCharacter.id;
              playerCharacters.set(player.id, storedCharacter);
            }
          }
          players.set(playerId, player);
          connections.set(socket, { playerId });
          await upsertPlayerProfile(player, stored?.lobby_id ?? null);
          sendMessage(socket, { type: "auth_ok", player });

          if (stored?.lobby_id) {
            const lobby = lobbies.get(stored.lobby_id);
            if (lobby) {
              if (!lobby.players.find((existing) => existing.id === player.id)) {
                lobby.players.push(player);
              }
              connections.set(socket, { playerId: player.id, lobbyId: lobby.id });
              await persistLobbyState(lobby);
              sendToLobby(lobby, { type: "lobby_joined", lobbyId: lobby.id, players: lobby.players });
              const match = matches.get(lobby.id);
              if (match) {
                sendMessage(socket, { type: "match_state", state: match });
              }
            }
          }
          return;
        }
        case "create_lobby": {
          const player = requirePlayer(socket);
          if (!player) return;
          const lobbyId = randomUUID();
          const lobby: Lobby = {
            id: lobbyId,
            name: message.name,
            maxPlayers: message.maxPlayers,
            players: [player],
            status: "open",
          };
          lobbies.set(lobbyId, lobby);
          connections.set(socket, { playerId: player.id, lobbyId });
          await persistLobbyState(lobby);
          broadcastLobbies();
          sendToLobby(lobby, { type: "lobby_joined", lobbyId, players: lobby.players });
          return;
        }
        case "join_lobby": {
          const player = requirePlayer(socket);
          if (!player) return;
          const lobby = lobbies.get(message.lobbyId);
          if (!lobby) {
            sendMessage(socket, { type: "error", message: "Lobby not available." });
            return;
          }
          if (lobby.status === "open") {
            if (lobby.players.length >= lobby.maxPlayers) {
              sendMessage(socket, { type: "error", message: "Lobby is full." });
              return;
            }
            lobby.players.push(player);
            connections.set(socket, { playerId: player.id, lobbyId: lobby.id });
            await persistLobbyState(lobby);
            broadcastLobbies();
            sendToLobby(lobby, { type: "lobby_joined", lobbyId: lobby.id, players: lobby.players });
            return;
          }
          connections.set(socket, { playerId: player.id, lobbyId: lobby.id });
          await upsertPlayerProfile(player, lobby.id);
          sendMessage(socket, { type: "lobby_joined", lobbyId: lobby.id, players: lobby.players });
          const match = matches.get(lobby.id);
          if (match) {
            sendMessage(socket, { type: "match_state", state: match });
          }
          return;
        }
        case "leave_lobby": {
          await leaveLobby(socket);
          return;
        }
        case "select_character": {
          const player = requirePlayer(socket);
          if (!player) return;
          playerCharacters.set(player.id, message.character);
          player.characterId = message.character.id;
          players.set(player.id, player);
          await upsertCharacter(message.character);
          const state = connections.get(socket);
          await upsertPlayerProfile(player, state?.lobbyId ?? null);
          return;
        }
        case "start_match": {
          const player = requirePlayer(socket);
          if (!player) return;
          const state = connections.get(socket);
          const lobby = state?.lobbyId ? lobbies.get(state.lobbyId) : undefined;
          if (!lobby) {
            sendMessage(socket, { type: "error", message: "Lobby not found." });
            return;
          }
          await ensureMinimumBots(lobby);
          lobby.status = "in_match";
          const matchState = createMatchState(lobby);
          matches.set(lobby.id, matchState);
          await persistLobbyState(lobby);
          await upsertMatch(lobby.id, matchState);
          broadcastLobbies();
          sendToLobby(lobby, { type: "match_state", state: matchState });
          scheduleBotTurn(lobby, matchState);
          return;
        }
        case "action": {
          const player = requirePlayer(socket);
          if (!player) return;
          const state = connections.get(socket);
          const lobby = state?.lobbyId ? lobbies.get(state.lobbyId) : undefined;
          if (!lobby) {
            sendMessage(socket, { type: "error", message: "Lobby not found." });
            return;
          }
          const match = matches.get(lobby.id);
          if (!match) {
            sendMessage(socket, { type: "error", message: "Match not found." });
            return;
          }
          if (message.action === "end_turn") {
            const updated = advanceTurn({
              ...match,
              log: [...match.log, `${player.name} ends their turn.`],
            });
            matches.set(lobby.id, updated);
            await upsertMatch(lobby.id, updated);
            sendToLobby(lobby, { type: "match_state", state: updated });
            scheduleBotTurn(lobby, updated);
            return;
          }
          sendMessage(socket, { type: "error", message: "Action handling not implemented." });
          return;
        }
        default:
          return;
      }
    });

    socket.on("close", () => {
      void leaveLobby(socket);
      connections.delete(socket);
    });
  });

  server.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
};

startServer().catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});
