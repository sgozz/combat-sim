import http from "node:http";
import { WebSocketServer } from "ws";
import type { ClientToServerMessage } from "../../shared/types";
import { state } from "./state";
import { initializeDatabase, loadPersistedData, updateMatchMemberConnection, getUserMatches, removeMatchMember, updateMatchState, getMatchMemberCount, cleanupExpiredSessions } from "./db";
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

  wss.on("connection", (socket, req) => {
    const ip = req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
    state.connections.set(socket, { ip });

    socket.on("message", async (data) => {
      let message: ClientToServerMessage;
      try {
        message = JSON.parse(data.toString()) as ClientToServerMessage;
      } catch {
        sendMessage(socket, { type: "error", message: "Invalid message format." });
        return;
      }

      const connState = state.connections.get(socket);
      await handleMessage(socket, wss, message, connState?.ip ?? 'unknown');
    });

    socket.on("close", async () => {
      const connState = state.connections.get(socket);
      if (connState?.userId) {
        const userId = connState.userId;
        state.removeUserSocket(userId, socket);
        const user = state.users.get(userId);
        
        const userMatches = getUserMatches(userId);
        for (const matchRow of userMatches) {
          if (matchRow.status === 'waiting') {
            const key = `${matchRow.id}:${userId}`;
            const existingTimer = state.pendingDisconnections.get(key);
            if (existingTimer) {
              clearTimeout(existingTimer);
            }
            
            const timer = setTimeout(async () => {
              const userSockets = state.getUserSockets(userId);
              if (userSockets.size === 0) {
                const readySet = state.readySets.get(matchRow.id);
                if (readySet) {
                  readySet.delete(userId);
                }
                
                removeMatchMember(matchRow.id, userId);
                
                const memberCount = getMatchMemberCount(matchRow.id);
                if (memberCount === 0) {
                  state.readySets.delete(matchRow.id);
                  state.db.prepare(`UPDATE matches SET status = 'finished' WHERE id = ?`).run(matchRow.id);
                }
                
                await sendToMatch(matchRow.id, { 
                  type: "player_left", 
                  matchId: matchRow.id, 
                  playerId: userId, 
                  playerName: user?.username ?? 'Unknown' 
                });
              }
              state.pendingDisconnections.delete(key);
            }, 3000);
            
            state.pendingDisconnections.set(key, timer);
          } else if (matchRow.status === 'active' || matchRow.status === 'paused') {
            updateMatchMemberConnection(matchRow.id, userId, false);
            
            const match = state.matches.get(matchRow.id);
            if (match && match.activeTurnPlayerId === userId && match.status === 'active') {
              const paused = { ...match, status: 'paused' as const, pausedForPlayerId: userId };
              state.matches.set(matchRow.id, paused);
              updateMatchState(matchRow.id, paused);
              await sendToMatch(matchRow.id, { type: "match_state", state: paused });
            }
            
            await sendToMatch(matchRow.id, { 
              type: "player_disconnected", 
              matchId: matchRow.id, 
              playerId: userId, 
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

    const expiredSessions = cleanupExpiredSessions();
    if (expiredSessions > 0) {
      console.log(`Cleanup: removed ${expiredSessions} expired sessions`);
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
