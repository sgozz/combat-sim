import type { CharacterSheet, MatchState, Player } from "../../shared/types";
import { isPF2Character } from "../../shared/types";
import type { CombatantState } from "../../shared/rulesets";
import { state } from "./state";
import { getRulesetServerFactory } from "./rulesets";
import { getMatchMembers, findUserById, loadCharacterById } from "./db";
import { assertRulesetId } from "../../shared/rulesets/defaults";

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
       const factory = getRulesetServerFactory(assertRulesetId(rulesetId));
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
     
     const factory = getRulesetServerFactory(assertRulesetId(rulesetId));
     return factory.createCombatant(character, player?.id ?? character.id, position, facing);
   });

  const initiativeOrder = combatants
    .map(c => {
      const char = characters.find(ch => ch.id === c.characterId);
      // Calculate initiative based on ruleset
      let initiative: number;
      let tiebreaker: number;
      if (char && isPF2Character(char)) {
        // PF2: perception + DEX modifier
        const dexMod = Math.floor((char.abilities.dexterity - 10) / 2);
        initiative = char.derived.perception + dexMod;
        tiebreaker = char.abilities.dexterity;
      } else if (char) {
        // GURPS: basicSpeed + dexterity/100 for tiebreaker
        initiative = char.derived.basicSpeed ?? 5;
        tiebreaker = char.attributes.dexterity ?? 10;
      } else {
        initiative = 5;
        tiebreaker = 10;
      }
      return {
        playerId: c.playerId,
        initiative,
        tiebreaker,
        random: Math.random(),
      };
    })
    .sort((a, b) => {
      if (b.initiative !== a.initiative) return b.initiative - a.initiative;
      if (b.tiebreaker !== a.tiebreaker) return b.tiebreaker - a.tiebreaker;
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
