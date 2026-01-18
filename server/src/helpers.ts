import { WebSocket } from "ws";
import type { CombatantState, GridPosition, MatchState, User, ServerToClientMessage } from "../../shared/types";
import { state } from "./state";
import { getMatchMembers } from "./db";

export const sendMessage = (socket: WebSocket, message: ServerToClientMessage) => {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  }
};

export const broadcast = (wss: { clients: Set<WebSocket> }, message: ServerToClientMessage) => {
  for (const socket of wss.clients) {
    sendMessage(socket, message);
  }
};

export const sendToUser = (userId: string, message: ServerToClientMessage) => {
  const sockets = state.getUserSockets(userId);
  for (const socket of sockets) {
    sendMessage(socket, message);
  }
};

export const sendToMatch = async (matchId: string, message: ServerToClientMessage) => {
  const members = await getMatchMembers(matchId);
  for (const member of members) {
    sendToUser(member.user_id, message);
  }
};

export const requireUser = (socket: WebSocket): User | null => {
  const connState = state.connections.get(socket);
  if (!connState?.userId) {
    sendMessage(socket, { type: "error", message: "Authenticate first." });
    return null;
  }
  const user = state.users.get(connState.userId);
  if (!user) {
    sendMessage(socket, { type: "error", message: "User not found." });
    return null;
  }
  return user;
};

export const calculateHexDistance = (from: GridPosition, to: GridPosition) => {
  const q1 = from.x, r1 = from.z;
  const q2 = to.x, r2 = to.z;
  const s1 = -q1 - r1;
  const s2 = -q2 - r2;
  return Math.max(Math.abs(q1 - q2), Math.abs(r1 - r2), Math.abs(s1 - s2));
};

export const getCombatantByPlayerId = (matchState: MatchState, playerId: string) => {
  return matchState.combatants.find((combatant) => combatant.playerId === playerId) ?? null;
};

export const getCharacterById = (matchState: MatchState, characterId: string) => {
  return matchState.characters.find((character) => character.id === characterId) ?? null;
};

export const isDefeated = (combatant: CombatantState): boolean => {
  return combatant.currentHP <= 0 || combatant.statusEffects.includes('unconscious');
};

export const getHexNeighbors = (q: number, r: number): GridPosition[] => {
  const directions = [
    { q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 },
    { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 },
  ];
  return directions.map((d) => ({ x: q + d.q, y: 0, z: r + d.r }));
};

export const findFreeAdjacentHex = (pos: GridPosition, combatants: CombatantState[]): GridPosition | null => {
  const neighbors = getHexNeighbors(pos.x, pos.z);
  for (const hex of neighbors) {
    const occupied = combatants.some(c => c.position.x === hex.x && c.position.z === hex.z);
    if (!occupied) return hex;
  }
  return null;
};

export const findRetreatHex = (
  defenderPos: GridPosition,
  attackerPos: GridPosition,
  combatants: CombatantState[]
): GridPosition | null => {
  const neighbors = getHexNeighbors(defenderPos.x, defenderPos.z);
  const currentDist = calculateHexDistance(defenderPos, attackerPos);
  
  const validRetreats = neighbors
    .filter(hex => {
      const occupied = combatants.some(c => c.position.x === hex.x && c.position.z === hex.z);
      if (occupied) return false;
      const newDist = calculateHexDistance(hex, attackerPos);
      return newDist > currentDist;
    })
    .sort((a, b) => calculateHexDistance(b, attackerPos) - calculateHexDistance(a, attackerPos));
  
  return validRetreats[0] ?? null;
};

export const calculateFacing = (from: GridPosition, to: GridPosition): number => {
  const dq = to.x - from.x;
  const dr = to.z - from.z;
  if (dq === 0 && dr === 0) return 0;

  const x = dq + dr / 2;
  const y = dr * Math.sqrt(3) / 2;
  const angle = Math.atan2(y, x);
  
  const sector = Math.round(-angle / (Math.PI / 3));
  return (sector + 6) % 6;
};

export const computeHexMoveToward = (
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

export const checkVictory = (match: MatchState): MatchState => {
  if (match.status === "finished") return match;

  const aliveCombatants = match.combatants.filter((c) => !isDefeated(c));
  if (aliveCombatants.length <= 1) {
    const winner = aliveCombatants[0];
    const winnerPlayer = winner ? match.players.find((p) => p.id === winner.playerId) : null;
    return {
      ...match,
      status: "finished",
      finishedAt: Date.now(),
      winnerId: winner?.playerId,
      log: [
        ...match.log,
        winnerPlayer ? `${winnerPlayer.name} wins!` : "Draw - no survivors!",
      ],
    };
  }
  return match;
};
