import { randomUUID } from "node:crypto";
import type { CharacterSheet, CombatantState, MatchState, Player } from "../../shared/types";
import type { Lobby } from "./types";
import { state } from "./state";
import { calculateDerivedStats } from "../../shared/rules";

export const createMatchState = (lobby: Lobby): MatchState => {
  const characters = lobby.players.map((player) => {
    const existing = state.playerCharacters.get(player.id);
    if (existing) return existing;
    const attributes = {
      strength: 10,
      dexterity: 10,
      intelligence: 10,
      health: 10,
    };
    const fallback: CharacterSheet = {
      id: randomUUID(),
      name: player.name,
      attributes,
      derived: calculateDerivedStats(attributes),
      skills: [{ id: randomUUID(), name: "Brawling", level: 12 }],
      advantages: [],
      disadvantages: [],
      equipment: [{ 
        id: randomUUID(), 
        name: "Club", 
        type: "melee",
        damage: "1d+1",
        reach: '1' as const,
        parry: 0,
        skillUsed: "Brawling"
      }],
      pointsTotal: 100,
    };
    state.playerCharacters.set(player.id, fallback);
    player.characterId = fallback.id;
    state.players.set(player.id, player);
    return fallback;
  });

  const combatants: CombatantState[] = characters.map((character, index) => {
    const player = lobby.players[index];
    const isBot = player?.isBot ?? false;
    const q = isBot ? 6 : -2;
    const r = index;
    const facing = isBot ? 3 : 0;
    return {
      playerId: player?.id ?? character.id,
      characterId: character.id,
      position: { x: q, y: 0, z: r },
      facing,
      posture: 'standing' as const,
      maneuver: null,
      aoaVariant: null,
      aodVariant: null,
      currentHP: character.derived.hitPoints,
      currentFP: character.derived.fatiguePoints,
      statusEffects: [],
      aimTurns: 0,
      aimTargetId: null,
      inCloseCombatWith: null,
      closeCombatPosition: null,
      grapple: { grappledBy: null, grappling: null, cpSpent: 0, cpReceived: 0 },
      usedReaction: false,
      shockPenalty: 0,
      attacksRemaining: 1,
      retreatedThisTurn: false,
      defensesThisTurn: 0,
    };
  });

  const initiativeOrder = combatants
    .map(c => {
      const char = characters.find(ch => ch.id === c.characterId);
      return {
        playerId: c.playerId,
        basicSpeed: char?.derived.basicSpeed ?? 5,
        dexterity: char?.attributes.dexterity ?? 10,
        random: Math.random(),
      };
    })
    .sort((a, b) => {
      if (b.basicSpeed !== a.basicSpeed) return b.basicSpeed - a.basicSpeed;
      if (b.dexterity !== a.dexterity) return b.dexterity - a.dexterity;
      return b.random - a.random;
    });
  
  const sortedPlayers = initiativeOrder.map(i => lobby.players.find(p => p.id === i.playerId)!);
  const firstPlayerId = sortedPlayers[0]?.id ?? "";

  return {
    id: randomUUID(),
    players: sortedPlayers,
    characters,
    combatants,
    activeTurnPlayerId: firstPlayerId,
    round: 1,
    log: ["Match started."],
    status: "active",
  };
};
