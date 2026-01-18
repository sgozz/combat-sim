const defenseTimeouts = new Map<string, NodeJS.Timeout>();

export const setDefenseTimeout = (lobbyId: string, callback: () => void, ms: number) => {
  clearDefenseTimeout(lobbyId);
  const timer = setTimeout(callback, ms);
  defenseTimeouts.set(lobbyId, timer);
};

export const clearDefenseTimeout = (lobbyId: string) => {
  const timer = defenseTimeouts.get(lobbyId);
  if (timer) {
    clearTimeout(timer);
    defenseTimeouts.delete(lobbyId);
  }
};
