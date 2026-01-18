import { WebSocket } from "ws";
import type { MatchState } from "../../shared/types";
import { state } from "./state";
import { deleteLobby, persistLobbyState, upsertPlayerProfile, upsertMatch, updateSessionLastSeen } from "./db";
import { sendMessage, summarizeLobby, broadcast, sendToLobby } from "./helpers";
import { clearDefenseTimeout } from "./timers";

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
  
  const matchIsActive = match && match.status === "active";
  const matchIsPaused = match && match.status === "paused";
  const shouldPauseMatch = matchIsActive && !departingPlayer?.isBot;
  const shouldEndPausedMatch = matchIsPaused && !departingPlayer?.isBot;
  const shouldRemovePlayer = lobby.status === "open" || (explicit && !matchIsActive && !matchIsPaused);
  
  if (shouldPauseMatch) {
    const pausedMatch: MatchState = {
      ...match,
      status: "paused",
      pausedForPlayerId: playerId,
      log: [...match.log, `${playerName} ${explicit ? 'left' : 'disconnected'}. Waiting for reconnection...`],
    };
    state.matches.set(lobbyId, pausedMatch);
    await upsertMatch(lobbyId, pausedMatch);
    cleanupBotTimer(lobbyId);
    clearDefenseTimeout(lobbyId);
    sendToLobby(lobby, { type: "match_paused", playerId, playerName });
    sendToLobby(lobby, { type: "match_state", state: pausedMatch });
    broadcastLobbies(wss);
    
    if (explicit) {
      sendMessage(socket, { type: "lobby_left" });
      state.connections.set(socket, { 
        sessionToken: connState.sessionToken, 
        userId: connState.userId, 
        playerId 
      });
    }
    return;
  }
  
  if (shouldEndPausedMatch && match) {
    const winnerId = match.pausedForPlayerId;
    const winnerPlayer = lobby.players.find(p => p.id === winnerId);
    const finishedMatch: MatchState = {
      ...match,
      status: "finished",
      finishedAt: Date.now(),
      winnerId,
      pausedForPlayerId: undefined,
      log: [...match.log, `${playerName} abandoned the match. ${winnerPlayer?.name ?? 'Opponent'} wins!`],
    };
    state.matches.set(lobbyId, finishedMatch);
    await upsertMatch(lobbyId, finishedMatch);
    
    lobby.players = lobby.players.filter(p => p.id !== playerId);
    
    if (departingPlayer) {
      await upsertPlayerProfile({ ...departingPlayer, characterId: departingPlayer.characterId }, null);
    }
    
    if (connState.sessionToken) {
      await updateSessionLastSeen(connState.sessionToken, null);
    }
    
    sendToLobby(lobby, { type: "match_state", state: finishedMatch });
    broadcastLobbies(wss);
    
    if (explicit) {
      sendMessage(socket, { type: "lobby_left" });
    }
    state.connections.set(socket, { 
      sessionToken: connState.sessionToken, 
      userId: connState.userId, 
      playerId 
    });
    return;
  }
  
  if (shouldRemovePlayer) {
    lobby.players = lobby.players.filter(p => p.id !== playerId);
    
    if (departingPlayer) {
      await upsertPlayerProfile({ ...departingPlayer, characterId: departingPlayer.characterId }, null);
    }
    
    if (connState.sessionToken) {
      await updateSessionLastSeen(connState.sessionToken, null);
    }
    
    if (lobby.players.filter(p => !p.isBot).length === 0) {
      cleanupBotTimer(lobbyId);
      state.lobbies.delete(lobbyId);
      state.matches.delete(lobbyId);
      await deleteLobby(lobbyId);
    } else {
      await persistLobbyState(lobby);
      sendToLobby(lobby, { type: "lobby_joined", lobbyId: lobby.id, players: lobby.players });
    }
    
    broadcastLobbies(wss);
    if (explicit) {
      sendMessage(socket, { type: "lobby_left" });
    }
    state.connections.set(socket, { 
      sessionToken: connState.sessionToken, 
      userId: connState.userId, 
      playerId 
    });
    return;
  }
  
  if (!explicit) {
    sendToLobby(lobby, { type: "player_disconnected", playerId, playerName });
  }
};
