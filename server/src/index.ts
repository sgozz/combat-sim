import http from "node:http";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { WebSocket, WebSocketServer } from "ws";
import sqlite3 from "sqlite3";
import { open, type Database } from "sqlite";
import type {
  CharacterSheet,
  ClientToServerMessage,
  CombatActionPayload,
  CombatantState,
  GridPosition,
  LobbySummary,
  MatchState,
  Player,
  ServerToClientMessage,
} from "../../shared/types";
import { advanceTurn, calculateDerivedStats, resolveAttack } from "../../shared/rules";

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

const leaveLobby = async (socket: WebSocket, explicit: boolean = false) => {
  const state = connections.get(socket);
  if (!state?.lobbyId || !state.playerId) {
    return;
  }
  const lobby = lobbies.get(state.lobbyId);
  if (!lobby) {
    connections.set(socket, { playerId: state.playerId });
    if (explicit) {
      sendMessage(socket, { type: "lobby_left" });
    }
    return;
  }
  if (explicit) {
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
    broadcastLobbies();
    sendMessage(socket, { type: "lobby_left" });
  }
  connections.set(socket, { playerId: state.playerId });
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

const calculateHexDistance = (from: GridPosition, to: GridPosition) => {
  const q1 = from.x, r1 = from.z;
  const q2 = to.x, r2 = to.z;
  const s1 = -q1 - r1;
  const s2 = -q2 - r2;
  return Math.max(Math.abs(q1 - q2), Math.abs(r1 - r2), Math.abs(s1 - s2));
};

const getCombatantByPlayerId = (state: MatchState, playerId: string) => {
  return state.combatants.find((combatant) => combatant.playerId === playerId) ?? null;
};

const getCharacterById = (state: MatchState, characterId: string) => {
  return state.characters.find((character) => character.id === characterId) ?? null;
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

  const combatants: CombatantState[] = characters.map((character, index) => {
    const player = lobby.players[index];
    const isBot = player?.isBot ?? false;
    const q = isBot ? 6 : -2;
    const r = index;
    const facing = isBot ? 3 : 0; // Bots face West (-q), Players face East (+q)
    return {
      playerId: player?.id ?? character.id,
      characterId: character.id,
      position: { x: q, y: 0, z: r },
      facing,
      maneuver: null,
      currentHP: character.derived.hitPoints,
      currentFP: character.derived.fatiguePoints,
      statusEffects: [],
    };
  });

  return {
    id: randomUUID(),
    players: lobby.players,
    characters,
    combatants,
    activeTurnPlayerId: lobby.players[0]?.id ?? "",
    round: 1,
    log: ["Match started."],
    status: "active",
  };
};

const checkVictory = (match: MatchState): MatchState => {
  if (match.status === "finished") return match;

  const aliveCombatants = match.combatants.filter((c) => c.currentHP > 0);
  if (aliveCombatants.length <= 1) {
    const winner = aliveCombatants[0];
    const winnerPlayer = winner ? match.players.find((p) => p.id === winner.playerId) : null;
    return {
      ...match,
      status: "finished",
      winnerId: winner?.playerId,
      log: [
        ...match.log,
        winnerPlayer ? `${winnerPlayer.name} wins!` : "Draw - no survivors!",
      ],
    };
  }
  return match;
};

const findNearestEnemy = (
  botCombatant: CombatantState,
  allCombatants: CombatantState[],
  botPlayerId: string
): CombatantState | null => {
  let nearest: CombatantState | null = null;
  let minDistance = Infinity;
  for (const combatant of allCombatants) {
    if (combatant.playerId === botPlayerId) continue;
    if (combatant.currentHP <= 0) continue;
    const dist = calculateHexDistance(botCombatant.position, combatant.position);
    if (dist < minDistance) {
      minDistance = dist;
      nearest = combatant;
    }
  }
  return nearest;
};

const getHexNeighbors = (q: number, r: number): GridPosition[] => {
  const directions = [
    { q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 },
    { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 },
  ];
  return directions.map((d) => ({ x: q + d.q, y: 0, z: r + d.r }));
};

const calculateFacing = (from: GridPosition, to: GridPosition): number => {
  const dq = to.x - from.x;
  const dr = to.z - from.z;
  if (dq === 0 && dr === 0) return 0;

  const x = dq + dr / 2;
  const y = dr * Math.sqrt(3) / 2;
  const angle = Math.atan2(y, x);
  
  const sector = Math.round(-angle / (Math.PI / 3));
  return (sector + 6) % 6;
};

const computeHexMoveToward = (
  from: GridPosition,
  to: GridPosition,
  maxMove: number,
  stopDistance: number = 1
): GridPosition => {
  let current = { ...from };
  let remaining = maxMove;

  while (remaining > 0) {
    const currentDist = calculateHexDistance(current, to);
    if (currentDist <= stopDistance) break;

    const neighbors = getHexNeighbors(current.x, current.z);
    let bestNeighbor = current;
    let bestDist = currentDist;

    for (const neighbor of neighbors) {
      const dist = calculateHexDistance(neighbor, to);
      if (dist < bestDist) {
        bestDist = dist;
        bestNeighbor = neighbor;
      }
    }

    if (bestDist >= currentDist) break;
    if (bestDist < stopDistance) break;
    current = bestNeighbor;
    remaining--;
  }

  return current;
};

const scheduleBotTurn = (lobby: Lobby, match: MatchState) => {
  if (match.status === "finished") {
    return;
  }
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

    const botCombatant = getCombatantByPlayerId(currentMatch, activePlayer.id);
    if (!botCombatant || botCombatant.currentHP <= 0) {
      const updated = advanceTurn({
        ...currentMatch,
        log: [...currentMatch.log, `${activePlayer.name} is incapacitated.`],
      });
      matches.set(lobby.id, updated);
      await upsertMatch(lobby.id, updated);
      sendToLobby(lobby, { type: "match_state", state: updated });
      scheduleBotTurn(lobby, updated);
      return;
    }

    const target = findNearestEnemy(botCombatant, currentMatch.combatants, activePlayer.id);
    if (!target) {
      const updated = advanceTurn({
        ...currentMatch,
        log: [...currentMatch.log, `${activePlayer.name} finds no targets.`],
      });
      matches.set(lobby.id, updated);
      await upsertMatch(lobby.id, updated);
      sendToLobby(lobby, { type: "match_state", state: updated });
      scheduleBotTurn(lobby, updated);
      return;
    }

    const distanceToTarget = calculateHexDistance(botCombatant.position, target.position);

    if (distanceToTarget <= 1) {
      const attackerCharacter = getCharacterById(currentMatch, botCombatant.characterId);
      const targetCharacter = getCharacterById(currentMatch, target.characterId);
      if (!attackerCharacter || !targetCharacter) {
        const updated = advanceTurn({
          ...currentMatch,
          log: [...currentMatch.log, `${activePlayer.name} waits.`],
        });
        matches.set(lobby.id, updated);
        await upsertMatch(lobby.id, updated);
        sendToLobby(lobby, { type: "match_state", state: updated });
        scheduleBotTurn(lobby, updated);
        return;
      }

      const skill = attackerCharacter.skills[0]?.level ?? attackerCharacter.attributes.dexterity;
      const defense = targetCharacter.derived.dodge;
      const damageFormula = attackerCharacter.equipment[0]?.damage ?? "1d";
      const result = resolveAttack({ skill, defense, damage: damageFormula });

      let updatedCombatants = currentMatch.combatants;
      let logEntry = `${attackerCharacter.name} attacks ${targetCharacter.name}`;

      if (result.outcome === "miss") {
        logEntry += ": miss.";
      } else if (result.outcome === "defended") {
        logEntry += ": defended.";
      } else {
        const damage = result.damage?.total ?? 0;
        updatedCombatants = currentMatch.combatants.map((combatant) => {
          if (combatant.playerId !== target.playerId) return combatant;
          const nextHp = Math.max(combatant.currentHP - damage, 0);
          return { ...combatant, currentHP: nextHp };
        });
        logEntry += `: hit for ${damage} damage.`;
      }

      let updated = advanceTurn({
        ...currentMatch,
        combatants: updatedCombatants,
        log: [...currentMatch.log, logEntry],
      });
      updated = checkVictory(updated);
      matches.set(lobby.id, updated);
      await upsertMatch(lobby.id, updated);
      sendToLobby(lobby, { type: "match_state", state: updated });
      scheduleBotTurn(lobby, updated);
      return;
    }

    const botCharacter = getCharacterById(currentMatch, botCombatant.characterId);
    const maxMove = botCharacter?.derived.basicMove ?? 5;
    const newPosition = computeHexMoveToward(botCombatant.position, target.position, maxMove);
    const newFacing = calculateFacing(botCombatant.position, newPosition);

    const updatedCombatants = currentMatch.combatants.map((combatant) =>
      combatant.playerId === activePlayer.id
        ? { ...combatant, position: newPosition, facing: newFacing }
        : combatant
    );

    const updated = advanceTurn({
      ...currentMatch,
      combatants: updatedCombatants,
      log: [...currentMatch.log, `${activePlayer.name} moves to (${newPosition.x}, ${newPosition.z}).`],
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
        case "list_lobbies": {
          sendMessage(socket, { type: "lobbies", lobbies: Array.from(lobbies.values()).map(summarizeLobby) });
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
          await leaveLobby(socket, true);
          return;
        }
        case "delete_lobby": {
          const player = requirePlayer(socket);
          if (!player) return;
          const lobbyToDelete = lobbies.get(message.lobbyId);
          if (!lobbyToDelete) {
            sendMessage(socket, { type: "error", message: "Lobby not found." });
            return;
          }
          for (const lobbyPlayer of lobbyToDelete.players) {
            await upsertPlayerProfile(lobbyPlayer, null);
          }
          lobbies.delete(message.lobbyId);
          matches.delete(message.lobbyId);
          await deleteLobby(message.lobbyId);
          const connState = connections.get(socket);
          if (connState?.lobbyId === message.lobbyId) {
            connections.set(socket, { playerId: connState.playerId });
          }
          broadcastLobbies();
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
          if (match.status === "finished") {
            sendMessage(socket, { type: "error", message: "Match is over." });
            return;
          }
          if (match.activeTurnPlayerId !== player.id) {
            sendMessage(socket, { type: "error", message: "Not your turn." });
            return;
          }
          const payload = message.payload as CombatActionPayload | undefined;
          if (!payload || payload.type !== message.action) {
            sendMessage(socket, { type: "error", message: "Invalid action payload." });
            return;
          }
          const actorCombatant = getCombatantByPlayerId(match, player.id);
          if (!actorCombatant) {
            sendMessage(socket, { type: "error", message: "Combatant not found." });
            return;
          }

          if (payload.type === "select_maneuver") {
            const updatedCombatants = match.combatants.map((c) =>
              c.playerId === player.id ? { ...c, maneuver: payload.maneuver } : c
            );
            const updated = {
              ...match,
              combatants: updatedCombatants,
              log: [...match.log, `${player.name} chooses ${payload.maneuver.replace(/_/g, " ")}.`],
            };
            matches.set(lobby.id, updated);
            await upsertMatch(lobby.id, updated);
            sendToLobby(lobby, { type: "match_state", state: updated });
            return;
          }

          if (!actorCombatant.maneuver) {
            sendMessage(socket, { type: "error", message: "Select a maneuver first." });
            return;
          }

          if (payload.type === "end_turn") {
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

          if (payload.type === "move") {
            const actorCharacter = getCharacterById(match, actorCombatant.characterId);
            if (!actorCharacter) {
              sendMessage(socket, { type: "error", message: "Character not found." });
              return;
            }
            const distance = calculateHexDistance(actorCombatant.position, payload.position);
            
            let allowed = actorCharacter.derived.basicMove;
            const m = actorCombatant.maneuver;
            
            if (m === 'do_nothing' || m === 'all_out_defense') { // AoD allows step? Yes (B366: Step or half move?) Let's say 1 step for now standard
               // Actually AoD (Increased Def) allows Step. AoD (Double) allows Step.
               // Do Nothing: No move.
               if (m === 'do_nothing') allowed = 0;
               else allowed = 1; // AoD step
            } else if (m === 'attack' || m === 'all_out_attack' || m === 'aim') {
               allowed = 1; // Step
               if (m === 'all_out_attack') allowed = Math.floor(actorCharacter.derived.basicMove / 2); // AoA allows half move
            } 
            // 'move', 'move_and_attack' allow full move (default)

            if (distance > allowed) {
              sendMessage(socket, { type: "error", message: `Move exceeds allowed for ${m} (${allowed}).` });
              return;
            }
            const newFacing = calculateFacing(actorCombatant.position, payload.position);
            const updatedCombatants = match.combatants.map((combatant) =>
              combatant.playerId === player.id
                ? { 
                    ...combatant, 
                    position: { x: payload.position.x, y: 0, z: payload.position.z },
                    facing: newFacing
                  }
                : combatant
            );
            const updated = advanceTurn({
              ...match,
              combatants: updatedCombatants,
              log: [...match.log, `${player.name} moves to (${payload.position.x}, ${payload.position.z}).`],
            });
            matches.set(lobby.id, updated);
            await upsertMatch(lobby.id, updated);
            sendToLobby(lobby, { type: "match_state", state: updated });
            scheduleBotTurn(lobby, updated);
            return;
          }

          if (payload.type === "defend") {
            const updated = advanceTurn({
              ...match,
              combatants: match.combatants.map((combatant) =>
                combatant.playerId === player.id
                  ? { ...combatant, statusEffects: [...combatant.statusEffects, "defending"] }
                  : combatant
              ),
              log: [...match.log, `${player.name} takes a defensive posture.`],
            });
            matches.set(lobby.id, updated);
            await upsertMatch(lobby.id, updated);
            sendToLobby(lobby, { type: "match_state", state: updated });
            scheduleBotTurn(lobby, updated);
            return;
          }

          if (payload.type === "attack") {
            const targetCombatant = match.combatants.find(
              (combatant) => combatant.playerId === payload.targetId
            );
            if (!targetCombatant) {
              sendMessage(socket, { type: "error", message: "Target not found." });
              return;
            }
            const distance = calculateHexDistance(actorCombatant.position, targetCombatant.position);
            if (distance > 1) {
              sendMessage(socket, { type: "error", message: "Target out of melee range." });
              return;
            }
            const attackerCharacter = getCharacterById(match, actorCombatant.characterId);
            const targetCharacter = getCharacterById(match, targetCombatant.characterId);
            if (!attackerCharacter || !targetCharacter) {
              sendMessage(socket, { type: "error", message: "Character not found." });
              return;
            }
            const skill = attackerCharacter.skills[0]?.level ?? attackerCharacter.attributes.dexterity;
            
            const targetFacing = targetCombatant.facing;
            const attackDirection = calculateFacing(targetCombatant.position, actorCombatant.position);
            const relativeDir = (attackDirection - targetFacing + 6) % 6;

            let defenseMod = 0;
            let canDefend = true;
            let defenseDescription = "normal";

            if (relativeDir === 3) { // Back
              canDefend = false;
              defenseDescription = "backstab (no defense)";
            } else if (relativeDir === 2 || relativeDir === 4) { // Side
              defenseMod = -2;
              defenseDescription = "flank (-2)";
            }

            const baseDefense = targetCharacter.derived.dodge;
            const effectiveDefense = canDefend ? baseDefense + defenseMod : undefined;
            const damageFormula = attackerCharacter.equipment[0]?.damage ?? "1d";
            const result = resolveAttack({ skill, defense: effectiveDefense, damage: damageFormula });

            let updatedCombatants = match.combatants;
            let logEntry = `${attackerCharacter.name} attacks ${targetCharacter.name} (${defenseDescription})`;

            const formatRoll = (r: { target: number, roll: number, success: boolean, margin: number, dice: number[] }, label: string) => 
              `(${label} ${r.target} vs ${r.roll} [${r.dice.join(', ')}]: ${r.success ? 'Made' : 'Missed'} by ${Math.abs(r.margin)})`;

            if (result.outcome === "miss") {
              logEntry += `: Miss. ${formatRoll(result.attack, 'Skill')}`;
              sendToLobby(lobby, { 
                type: "visual_effect", 
                effect: { type: "miss", targetId: targetCombatant.playerId, position: targetCombatant.position } 
              });
            } else if (result.outcome === "defended") {
              logEntry += `: Defended. ${formatRoll(result.attack, 'Attack')} -> ${formatRoll(result.defense!, 'Defense')}`;
              sendToLobby(lobby, { 
                type: "visual_effect", 
                effect: { type: "defend", targetId: targetCombatant.playerId, position: targetCombatant.position } 
              });
            } else {
              const dmg = result.damage!;
              const damage = dmg.total;
              const rolls = dmg.rolls.join(',');
              const mod = dmg.modifier !== 0 ? (dmg.modifier > 0 ? `+${dmg.modifier}` : `${dmg.modifier}`) : '';
              const dmgDetail = `(${damageFormula}: [${rolls}]${mod})`;

              updatedCombatants = match.combatants.map((combatant) => {
                if (combatant.playerId !== targetCombatant.playerId) return combatant;
                const nextHp = Math.max(combatant.currentHP - damage, 0);
                return {
                  ...combatant,
                  currentHP: nextHp,
                  statusEffects: damage > 0 ? [...combatant.statusEffects, "shock"] : combatant.statusEffects,
                };
              });
              logEntry += `: Hit for ${damage} damage ${dmgDetail}. ${formatRoll(result.attack, 'Attack')}`;
              sendToLobby(lobby, { 
                type: "visual_effect", 
                effect: { type: "damage", targetId: targetCombatant.playerId, value: damage, position: targetCombatant.position } 
              });
            }

            let updated = advanceTurn({
              ...match,
              combatants: updatedCombatants,
              log: [...match.log, logEntry],
            });
            updated = checkVictory(updated);
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
      void leaveLobby(socket, false);
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
