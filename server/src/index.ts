import http from "node:http";
import { randomUUID } from "node:crypto";
import { WebSocket, WebSocketServer } from "ws";
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

const players = new Map<string, Player>();
const playerCharacters = new Map<string, CharacterSheet>();
const lobbies = new Map<string, Lobby>();
const connections = new Map<WebSocket, ConnectionState>();
const matches = new Map<string, MatchState>();
const botTimers = new Map<string, NodeJS.Timeout>();
let botCount = 1;

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

const leaveLobby = (socket: WebSocket) => {
  const state = connections.get(socket);
  if (!state?.lobbyId || !state.playerId) {
    return;
  }
  const lobby = lobbies.get(state.lobbyId);
  if (!lobby) {
    connections.set(socket, { playerId: state.playerId });
    return;
  }
  lobby.players = lobby.players.filter((player) => player.id !== state.playerId);
  if (lobby.players.length === 0) {
    lobbies.delete(lobby.id);
    matches.delete(lobby.id);
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

const addBotToLobby = (lobby: Lobby) => {
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
};

const ensureMinimumBots = (lobby: Lobby) => {
  while (lobby.players.length < 2) {
    addBotToLobby(lobby);
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
  const timer = setTimeout(() => {
    const currentMatch = matches.get(lobby.id);
    if (!currentMatch) return;
    const updated = advanceTurn({
      ...currentMatch,
      log: [...currentMatch.log, `${activePlayer.name} waits.`],
    });
    matches.set(lobby.id, updated);
    sendToLobby(lobby, { type: "match_state", state: updated });
    scheduleBotTurn(lobby, updated);
  }, 800);
  botTimers.set(lobby.id, timer);
};

wss.on("connection", (socket) => {
  connections.set(socket, {});
  sendMessage(socket, { type: "lobbies", lobbies: Array.from(lobbies.values()).map(summarizeLobby) });

  socket.on("message", (data) => {
    let message: ClientToServerMessage;
    try {
      message = JSON.parse(data.toString()) as ClientToServerMessage;
    } catch {
      sendMessage(socket, { type: "error", message: "Invalid message format." });
      return;
    }

    switch (message.type) {
      case "auth": {
        const playerId = randomUUID();
        const player: Player = {
          id: playerId,
          name: message.name,
          isBot: false,
          characterId: "",
        };
        players.set(playerId, player);
        connections.set(socket, { playerId });
        sendMessage(socket, { type: "auth_ok", player });
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
        broadcastLobbies();
        sendToLobby(lobby, { type: "lobby_joined", lobbyId, players: lobby.players });
        return;
      }
      case "join_lobby": {
        const player = requirePlayer(socket);
        if (!player) return;
        const lobby = lobbies.get(message.lobbyId);
        if (!lobby || lobby.status !== "open") {
          sendMessage(socket, { type: "error", message: "Lobby not available." });
          return;
        }
        if (lobby.players.length >= lobby.maxPlayers) {
          sendMessage(socket, { type: "error", message: "Lobby is full." });
          return;
        }
        lobby.players.push(player);
        connections.set(socket, { playerId: player.id, lobbyId: lobby.id });
        broadcastLobbies();
        sendToLobby(lobby, { type: "lobby_joined", lobbyId: lobby.id, players: lobby.players });
        return;
      }
      case "leave_lobby": {
        leaveLobby(socket);
        return;
      }
      case "select_character": {
        const player = requirePlayer(socket);
        if (!player) return;
        playerCharacters.set(player.id, message.character);
        player.characterId = message.character.id;
        players.set(player.id, player);
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
        ensureMinimumBots(lobby);
        lobby.status = "in_match";
        const matchState = createMatchState(lobby);
        matches.set(lobby.id, matchState);
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
    leaveLobby(socket);
    connections.delete(socket);
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
