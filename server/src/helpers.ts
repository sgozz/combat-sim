import { WebSocket } from "ws";
import type { GridPosition, MatchState, User, ServerToClientMessage } from "../../shared/types";
import type { CombatantState } from "../../shared/rulesets/gurps/types";
import type { GridSystem, GridCoord } from "../../shared/grid";
import { hexGrid } from "../../shared/grid";
import { getServerAdapter } from "../../shared/rulesets/serverAdapter";
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
  
  const spectators = state.getSpectators(matchId);
  for (const specUserId of spectators) {
    sendToUser(specUserId, message);
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

export const calculateGridDistance = (
  from: GridPosition,
  to: GridPosition,
  gridSystem: GridSystem
): number => {
  const coordFrom: GridCoord = { q: from.x, r: from.z };
  const coordTo: GridCoord = { q: to.x, r: to.z };
  return gridSystem.distance(coordFrom, coordTo);
};

export const getGridSystemForMatch = (match: MatchState): GridSystem => {
  return getServerAdapter(match.rulesetId ?? 'gurps').gridSystem;
};

export const calculateHexDistance = (from: GridPosition, to: GridPosition) => {
  return calculateGridDistance(from, to, hexGrid);
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

export const getGridNeighbors = (q: number, r: number, gridSystem: GridSystem): GridPosition[] => {
  const coord: GridCoord = { q, r };
  return gridSystem.neighbors(coord).map((n) => ({ x: n.q, y: 0, z: n.r }));
};

export const getHexNeighbors = (q: number, r: number): GridPosition[] => {
  return getGridNeighbors(q, r, hexGrid);
};

export const findFreeAdjacentCell = (
  pos: GridPosition,
  combatants: CombatantState[],
  gridSystem: GridSystem
): GridPosition | null => {
  const neighbors = getGridNeighbors(pos.x, pos.z, gridSystem);
  for (const cell of neighbors) {
    const occupied = combatants.some(c => c.position.x === cell.x && c.position.z === cell.z);
    if (!occupied) return cell;
  }
  return null;
};

export const findFreeAdjacentHex = (pos: GridPosition, combatants: CombatantState[]): GridPosition | null => {
  return findFreeAdjacentCell(pos, combatants, hexGrid);
};

export const findRetreatCell = (
  defenderPos: GridPosition,
  attackerPos: GridPosition,
  combatants: CombatantState[],
  gridSystem: GridSystem
): GridPosition | null => {
  const neighbors = getGridNeighbors(defenderPos.x, defenderPos.z, gridSystem);
  const currentDist = calculateGridDistance(defenderPos, attackerPos, gridSystem);
  
  const validRetreats = neighbors
    .filter(cell => {
      const occupied = combatants.some(c => c.position.x === cell.x && c.position.z === cell.z);
      if (occupied) return false;
      const newDist = calculateGridDistance(cell, attackerPos, gridSystem);
      return newDist > currentDist;
    })
    .sort((a, b) => calculateGridDistance(b, attackerPos, gridSystem) - calculateGridDistance(a, attackerPos, gridSystem));
  
  return validRetreats[0] ?? null;
};

export const findRetreatHex = (
  defenderPos: GridPosition,
  attackerPos: GridPosition,
  combatants: CombatantState[]
): GridPosition | null => {
  return findRetreatCell(defenderPos, attackerPos, combatants, hexGrid);
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

export const computeGridMoveToward = (
  from: GridPosition,
  to: GridPosition,
  maxMove: number,
  gridSystem: GridSystem,
  stopDistance: number = 1
): GridPosition => {
  let current = { ...from };
  let remaining = maxMove;

  while (remaining > 0) {
    const currentDist = calculateGridDistance(current, to, gridSystem);
    if (currentDist <= stopDistance) break;

    const neighbors = getGridNeighbors(current.x, current.z, gridSystem);
    let bestNeighbor = current;
    let bestDist = currentDist;

    for (const neighbor of neighbors) {
      const dist = calculateGridDistance(neighbor, to, gridSystem);
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

export const computeHexMoveToward = (
  from: GridPosition,
  to: GridPosition,
  maxMove: number,
  stopDistance: number = 1
): GridPosition => {
  return computeGridMoveToward(from, to, maxMove, hexGrid, stopDistance);
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
