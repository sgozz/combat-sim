import { WebSocket } from "ws";
import type { MatchState } from "../../shared/types";
import { state } from "./state";
import { deleteLobby, persistLobbyState, upsertPlayerProfile, upsertMatch, updateSessionLastSeen } from "./db";
import { sendMessage, summarizeLobby, broadcast, sendToLobby } from "./helpers";

export const broadcastLobbies = (wss: { clients: Set<WebSocket> }) => {
  const lobbiesSummary = Array.from(state.lobbies.values()).map(summarizeLobby);
  broadcast(wss, { type: "lobbies", lobbies: lobbiesSummary });
};

const cleanupBotTimer = (lobbyId: string) => {
  const timer = state.botTimers.get(lobbyId);
  if (timer) {
    clearTimeout(timer);
    state.botTimers.delete(lobbyId);
  }
};

export const leaveLobby = async (socket: WebSocket, wss: { clients: Set<WebSocket> }, explicit: boolean = false) => {
  const connState = state.connections.get(socket);
  if (!connState?.lobbyId || !connState.playerId) {
    return;
  }
  
  const lobbyId = connState.lobbyId;
  const playerId = connState.playerId;
  const lobby = state.lobbies.get(lobbyId);
  
  if (!lobby) {
    state.connections.set(socket, { 
      sessionToken: connState.sessionToken, 
      userId: connState.userId, 
      playerId 
    });
    if (explicit) {
      sendMessage(socket, { type: "lobby_left" });
    }
    return;
  }
  
  const departingPlayer = lobby.players.find((player) => player.id === playerId);
  const playerName = departingPlayer?.name ?? "Player";
  const match = state.matches.get(lobbyId);
  
  if (explicit) {
    lobby.players = lobby.players.filter((player) => player.id !== playerId);
    
    if (departingPlayer) {
      await upsertPlayerProfile({ ...departingPlayer, characterId: departingPlayer.characterId }, null);
    }
    
    if (connState.sessionToken) {
      await updateSessionLastSeen(connState.sessionToken, null);
    }
    
    if (match && match.status !== "finished") {
      const opponent = match.players.find(p => p.id !== playerId);
      const finishedMatch: MatchState = {
        ...match,
        status: "finished",
        finishedAt: Date.now(),
        winnerId: opponent?.id,
        log: [...match.log, `${playerName} left the game. ${opponent?.name ?? 'Opponent'} wins!`],
      };
      state.matches.set(lobbyId, finishedMatch);
      await upsertMatch(lobbyId, finishedMatch);
      cleanupBotTimer(lobbyId);
      sendToLobby(lobby, { type: "match_state", state: finishedMatch });
    }
    
    if (lobby.players.filter(p => !p.isBot).length === 0) {
      cleanupBotTimer(lobbyId);
      state.lobbies.delete(lobbyId);
      state.matches.delete(lobbyId);
      await deleteLobby(lobbyId);
    } else {
      await persistLobbyState(lobby);
    }
    
    broadcastLobbies(wss);
    sendMessage(socket, { type: "lobby_left" });
    state.connections.set(socket, { 
      sessionToken: connState.sessionToken, 
      userId: connState.userId, 
      playerId 
    });
    return;
  }
  
  if (match && match.status === "active") {
    const isMyTurn = match.activeTurnPlayerId === playerId;
    const isPendingDefense = match.pendingDefense?.defenderId === playerId;
    
    if (isMyTurn || isPendingDefense) {
      const pausedMatch: MatchState = {
        ...match,
        status: "paused",
        pausedForPlayerId: playerId,
        log: [...match.log, `${playerName} disconnected. Waiting for reconnection...`],
      };
      state.matches.set(lobbyId, pausedMatch);
      await upsertMatch(lobbyId, pausedMatch);
      cleanupBotTimer(lobbyId);
      sendToLobby(lobby, { type: "match_paused", playerId, playerName });
      sendToLobby(lobby, { type: "match_state", state: pausedMatch });
    } else {
      sendToLobby(lobby, { type: "player_disconnected", playerId, playerName });
    }
  }
};
