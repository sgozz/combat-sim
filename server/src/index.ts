import http from "node:http";
import { WebSocketServer } from "ws";
import type { ClientToServerMessage } from "../../shared/types";
import { state } from "./state";
import { initializeDatabase, loadPersistedData, deleteLobby } from "./db";
import { sendMessage, summarizeLobby, broadcast } from "./helpers";
import { leaveLobby } from "./lobby";
import { handleMessage } from "./handlers";

const PORT = Number(process.env.PORT ?? 8080);

const server = http.createServer((_, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ status: "ok" }));
});

const wss = new WebSocketServer({ server });

const startServer = async () => {
  const db = await initializeDatabase();
  state.setDb(db);
  await loadPersistedData();
  
  const storedPlayers = await db.get<{ count: number }>("SELECT COUNT(*) as count FROM players");
  const storedCharacters = await db.get<{ count: number }>("SELECT COUNT(*) as count FROM characters");
  console.log(`Loaded ${storedPlayers?.count ?? 0} player profiles and ${storedCharacters?.count ?? 0} characters.`);

  wss.on("connection", (socket) => {
    state.connections.set(socket, {});
    sendMessage(socket, { type: "lobbies", lobbies: Array.from(state.lobbies.values()).map(summarizeLobby) });

    socket.on("message", async (data) => {
      let message: ClientToServerMessage;
      try {
        message = JSON.parse(data.toString()) as ClientToServerMessage;
      } catch {
        sendMessage(socket, { type: "error", message: "Invalid message format." });
        return;
      }

      await handleMessage(socket, wss, message);
    });

    socket.on("close", () => {
      void leaveLobby(socket, wss, false);
      state.connections.delete(socket);
    });
  });

  server.listen(PORT, async () => {
    console.log(`Server listening on http://localhost:${PORT}`);
    
    const staleLobbies = Array.from(state.lobbies.entries()).filter(([, lobby]) => lobby.status === "in_match");
    for (const [lobbyId] of staleLobbies) {
      const timer = state.botTimers.get(lobbyId);
      if (timer) {
        clearTimeout(timer);
        state.botTimers.delete(lobbyId);
      }
      state.matches.delete(lobbyId);
      state.lobbies.delete(lobbyId);
      await deleteLobby(lobbyId);
    }
    if (staleLobbies.length > 0) {
      console.log(`Startup cleanup: removed ${staleLobbies.length} stale in-progress lobbies`);
    }
  });

  const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;
  const FINISHED_MATCH_TTL_MS = 60 * 60 * 1000;

  const getConnectedPlayerIds = (): Set<string> => {
    const connected = new Set<string>();
    for (const connState of state.connections.values()) {
      if (connState.playerId) connected.add(connState.playerId);
    }
    return connected;
  };

  const cleanupOrphanedLobbies = async () => {
    const now = Date.now();
    let cleanedCount = 0;
    const connectedPlayers = getConnectedPlayerIds();

    for (const [lobbyId, lobby] of state.lobbies.entries()) {
      const match = state.matches.get(lobbyId);
      let shouldDelete = false;

      if (match?.status === "finished" && match.finishedAt) {
        const age = now - match.finishedAt;
        if (age > FINISHED_MATCH_TTL_MS) {
          shouldDelete = true;
        }
      }

      if (lobby.status === "in_match") {
        const humanPlayers = lobby.players.filter(p => !p.isBot);
        const hasConnectedPlayer = humanPlayers.some(p => connectedPlayers.has(p.id));
        if (!hasConnectedPlayer) {
          shouldDelete = true;
        }
      }

      if (shouldDelete) {
        const timer = state.botTimers.get(lobbyId);
        if (timer) {
          clearTimeout(timer);
          state.botTimers.delete(lobbyId);
        }
        state.matches.delete(lobbyId);
        state.lobbies.delete(lobbyId);
        await deleteLobby(lobbyId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`Cleanup: removed ${cleanedCount} orphaned/finished lobbies`);
      broadcast(wss, { type: "lobbies", lobbies: Array.from(state.lobbies.values()).map(summarizeLobby) });
    }
  };

  setInterval(() => {
    cleanupOrphanedLobbies().catch(err => console.error("Cleanup error:", err));
  }, CLEANUP_INTERVAL_MS);
};

startServer().catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});
