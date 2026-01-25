import { randomUUID } from "node:crypto";
import type { CharacterSheet, MatchState, Player } from "../../shared/types";
import type { CombatantState, EquippedItem } from "../../shared/rulesets/gurps/types";
import { state } from "./state";
import { getServerAdapter } from "../../shared/rulesets/serverAdapter";
import { getRulesetServerFactory } from "./rulesets";
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
       const factory = getRulesetServerFactory(rulesetId ?? 'gurps');
       character = factory.createDefaultCharacter(user.username);
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
     const position = { x: finalQ, y: 0, z: finalR };
     
     const factory = getRulesetServerFactory(rulesetId ?? 'gurps');
     return factory.createCombatant(character, player?.id ?? character.id, position, facing);
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
