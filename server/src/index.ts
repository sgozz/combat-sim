import http from "node:http";
import { WebSocketServer } from "ws";
import type { ClientToServerMessage } from "../../shared/types";
import { state } from "./state";
import { initializeDatabase, loadPersistedData, updateMatchMemberConnection, getUserMatches, removeMatchMember, updateMatchState, getMatchMemberCount } from "./db";
import { sendMessage, sendToMatch } from "./helpers";
import { handleMessage } from "./handlers";

const PORT = Number(process.env.PORT ?? 8080);

const server = http.createServer((_, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ status: "ok" }));
});

const wss = new WebSocketServer({ server });

const startServer = async () => {
  const db = initializeDatabase();
  state.setDb(db);
  loadPersistedData();
  
  const storedUsers = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number } | undefined;
  const storedCharacters = db.prepare("SELECT COUNT(*) as count FROM characters").get() as { count: number } | undefined;
  const storedMatches = db.prepare("SELECT COUNT(*) as count FROM matches WHERE status IN ('waiting', 'active', 'paused')").get() as { count: number } | undefined;
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
        const user = state.users.get(connState.userId);
        
        const userMatches = getUserMatches(connState.userId);
        for (const matchRow of userMatches) {
          if (matchRow.status === 'waiting') {
            const readySet = state.readySets.get(matchRow.id);
            if (readySet) {
              readySet.delete(connState.userId);
            }
            
            removeMatchMember(matchRow.id, connState.userId);
            
            const memberCount = getMatchMemberCount(matchRow.id);
            if (memberCount === 0) {
              state.readySets.delete(matchRow.id);
              state.db.prepare(`UPDATE matches SET status = 'finished' WHERE id = ?`).run(matchRow.id);
            }
            
            await sendToMatch(matchRow.id, { 
              type: "player_left", 
              matchId: matchRow.id, 
              playerId: connState.userId, 
              playerName: user?.username ?? 'Unknown' 
            });
          } else if (matchRow.status === 'active' || matchRow.status === 'paused') {
            updateMatchMemberConnection(matchRow.id, connState.userId, false);
            
            const match = state.matches.get(matchRow.id);
            if (match && match.activeTurnPlayerId === connState.userId && match.status === 'active') {
              const paused = { ...match, status: 'paused' as const, pausedForPlayerId: connState.userId };
              state.matches.set(matchRow.id, paused);
              updateMatchState(matchRow.id, paused);
              await sendToMatch(matchRow.id, { type: "match_state", state: paused });
            }
            
            await sendToMatch(matchRow.id, { 
              type: "player_disconnected", 
              matchId: matchRow.id, 
              playerId: connState.userId, 
              playerName: user?.username ?? 'Unknown' 
            });
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
