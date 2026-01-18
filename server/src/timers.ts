const defenseTimeouts = new Map<string, NodeJS.Timeout>();

export const clearDefenseTimeout = (lobbyId: string) => {
  const timer = defenseTimeouts.get(lobbyId);
  if (timer) {
    clearTimeout(timer);
    defenseTimeouts.delete(lobbyId);
  }
};
