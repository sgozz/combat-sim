import { WebSocket } from "ws";
import { state } from "./state";
import { deleteLobby, persistLobbyState, upsertPlayerProfile } from "./db";
import { sendMessage, summarizeLobby, broadcast } from "./helpers";

export const broadcastLobbies = (wss: { clients: Set<WebSocket> }) => {
  const lobbiesSummary = Array.from(state.lobbies.values()).map(summarizeLobby);
  broadcast(wss, { type: "lobbies", lobbies: lobbiesSummary });
};

export const leaveLobby = async (socket: WebSocket, wss: { clients: Set<WebSocket> }, explicit: boolean = false) => {
  const connState = state.connections.get(socket);
  if (!connState?.lobbyId || !connState.playerId) {
    return;
  }
  const lobby = state.lobbies.get(connState.lobbyId);
  if (!lobby) {
    state.connections.set(socket, { playerId: connState.playerId });
    if (explicit) {
      sendMessage(socket, { type: "lobby_left" });
    }
    return;
  }
  if (explicit) {
    const departingPlayer = lobby.players.find((player) => player.id === connState.playerId) ?? null;
    lobby.players = lobby.players.filter((player) => player.id !== connState.playerId);
    if (departingPlayer) {
      await upsertPlayerProfile({ ...departingPlayer, characterId: departingPlayer.characterId }, null);
    }
    if (lobby.players.length === 0) {
      state.lobbies.delete(lobby.id);
      state.matches.delete(lobby.id);
      await deleteLobby(lobby.id);
    } else {
      await persistLobbyState(lobby);
    }
    broadcastLobbies(wss);
    sendMessage(socket, { type: "lobby_left" });
  }
  state.connections.set(socket, { playerId: connState.playerId });
};
