const defenseTimeouts = new Map<string, NodeJS.Timeout>();

export const clearDefenseTimeout = (matchId: string) => {
  const timer = defenseTimeouts.get(matchId);
  if (timer) {
    clearTimeout(timer);
    defenseTimeouts.delete(matchId);
  }
};
