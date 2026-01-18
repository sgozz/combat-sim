import http from "node:http";
import { WebSocketServer } from "ws";
import type { ClientToServerMessage } from "../../shared/types";
import { state } from "./state";
import { initializeDatabase, loadPersistedData, updateMatchMemberConnection, getUserMatches, buildMatchSummary } from "./db";
import { sendMessage, sendToUser } from "./helpers";
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
  
  const storedUsers = await db.get<{ count: number }>("SELECT COUNT(*) as count FROM users");
  const storedCharacters = await db.get<{ count: number }>("SELECT COUNT(*) as count FROM characters");
  const storedMatches = await db.get<{ count: number }>("SELECT COUNT(*) as count FROM matches WHERE status IN ('waiting', 'active', 'paused')");
  console.log(`Loaded ${storedUsers?.count ?? 0} users, ${storedCharacters?.count ?? 0} characters, ${storedMatches?.count ?? 0} active matches.`);

  wss.on("connection", (socket) => {
    state.connections.set(socket, {});

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

    socket.on("close", async () => {
      const connState = state.connections.get(socket);
      if (connState?.userId) {
        state.removeUserSocket(connState.userId, socket);
        
        const userMatches = await getUserMatches(connState.userId);
        for (const matchRow of userMatches) {
          if (matchRow.status === 'active' || matchRow.status === 'waiting') {
            await updateMatchMemberConnection(matchRow.id, connState.userId, false);
            
            const summary = await buildMatchSummary(matchRow, connState.userId);
            const user = state.users.get(connState.userId);
            if (user) {
              for (const player of summary.players) {
                if (player.id !== connState.userId) {
                  sendToUser(player.id, { type: "match_updated", match: summary });
                }
              }
            }
          }
        }
      }
      state.connections.delete(socket);
    });
  });

  server.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });

  const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;
  const FINISHED_MATCH_TTL_MS = 24 * 60 * 60 * 1000;

  const cleanupOldMatches = async () => {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [matchId, match] of state.matches.entries()) {
      if (match.status === "finished" && match.finishedAt) {
        const age = now - match.finishedAt;
        if (age > FINISHED_MATCH_TTL_MS) {
          const timer = state.botTimers.get(matchId);
          if (timer) {
            clearTimeout(timer);
            state.botTimers.delete(matchId);
          }
          state.matches.delete(matchId);
          cleanedCount++;
        }
      }
    }

    if (cleanedCount > 0) {
      console.log(`Cleanup: removed ${cleanedCount} finished matches from memory`);
    }
  };

  setInterval(() => {
    cleanupOldMatches().catch(err => console.error("Cleanup error:", err));
  }, CLEANUP_INTERVAL_MS);
};

startServer().catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});
