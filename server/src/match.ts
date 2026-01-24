import { randomUUID } from "node:crypto";
import type { CharacterSheet, CombatantState, MatchState, EquippedItem, Player } from "../../shared/types";
import { state } from "./state";
import { getServerAdapter } from "../../shared/rulesets/serverAdapter";
import { getMatchMembers, findUserById, loadCharacterById } from "./db";

export const createMatchState = async (
  matchId: string,
  name: string,
  code: string,
  maxPlayers: number,
  rulesetId: MatchState['rulesetId']
): Promise<MatchState> => {
  const members = await getMatchMembers(matchId);
  
  const players: Player[] = [];
  const characters: CharacterSheet[] = [];
  
  for (const member of members) {
    const user = await findUserById(member.user_id);
    if (!user) continue;
    
    let character: CharacterSheet | null = null;
    if (member.character_id) {
      character = await loadCharacterById(member.character_id);
      if (!character) {
        character = state.characters.get(member.character_id) ?? null;
      }
    }
    
    if (!character) {
      const adapter = getServerAdapter(rulesetId ?? 'gurps');
      const attributes = {
        strength: 10,
        dexterity: 10,
        intelligence: 10,
        health: 10,
      };
      character = {
        id: randomUUID(),
        name: user.username,
        attributes,
        derived: adapter.calculateDerivedStats(attributes),
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
    }
    
    const player: Player = {
      id: user.id,
      name: user.username,
      isBot: user.isBot,
      characterId: character.id,
    };
    players.push(player);
    characters.push(character);
  }

  const combatants: CombatantState[] = characters.map((character, index) => {
    const player = players[index];
    const isBot = player?.isBot ?? false;
    const spawnRow = Math.floor(index / 2);
    const spawnOffset = index % 2 === 0 ? -1 : 1;
    const q = isBot ? 6 + spawnOffset : -2 + spawnOffset;
    const r = spawnRow;
    const facing = isBot ? 3 : 0;

    const randomShift = Math.random() < 0.5 ? 0 : 1;
    const finalQ = q + randomShift;
    const finalR = r + (Math.random() < 0.5 ? 0 : 1);
    
    const equipped: EquippedItem[] = [];
    const primaryWeapon = character.equipment.find(e => e.type === 'melee' || e.type === 'ranged');
    const shield = character.equipment.find(e => e.type === 'shield');
    
    if (primaryWeapon) {
      equipped.push({ equipmentId: primaryWeapon.id, slot: 'right_hand', ready: true });
    }
    if (shield) {
      equipped.push({ equipmentId: shield.id, slot: 'left_hand', ready: true });
    }
    
    const baseCombatant = {
      playerId: player?.id ?? character.id,
      characterId: character.id,
      position: { x: finalQ, y: 0, z: finalR },
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
      evaluateBonus: 0,
      evaluateTargetId: null,
      equipped,
      inCloseCombatWith: null,
      closeCombatPosition: null,
      grapple: { grappledBy: null, grappling: null, cpSpent: 0, cpReceived: 0 },
      usedReaction: false,
      shockPenalty: 0,
      attacksRemaining: rulesetId === 'pf2' ? 3 : 1,
      retreatedThisTurn: false,
      defensesThisTurn: 0,
      parryWeaponsUsedThisTurn: [],
      waitTrigger: null,
    };
    
    if (rulesetId === 'pf2') {
      return {
        ...baseCombatant,
        pf2: {
          actionsRemaining: 3,
          reactionAvailable: true,
          mapPenalty: 0,
          attacksThisTurn: 0,
          shieldRaised: false,
        },
      };
    }
    
    return baseCombatant;
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
  
  const sortedPlayers = initiativeOrder.map(i => players.find(p => p.id === i.playerId)!);
  const firstPlayerId = sortedPlayers[0]?.id ?? "";

  return {
    id: matchId,
    name,
    code,
    maxPlayers,
    rulesetId,
    createdAt: Date.now(),
    players: sortedPlayers,
    characters,
    combatants,
    activeTurnPlayerId: firstPlayerId,
    round: 1,
    log: ["Match started."],
    status: "active",
  };
};
