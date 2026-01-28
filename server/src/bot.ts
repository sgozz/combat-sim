import type { CharacterSheet, MatchState, User, RulesetId } from "../../shared/types";
import { isPF2Character, isGurpsCharacter } from "../../shared/types";
import type { CombatantState } from "../../shared/rulesets";
import { isGurpsCombatant } from "../../shared/rulesets";
import { state } from "./state";
import { createUser, addMatchMember, updateMatchState, upsertCharacter } from "./db";
import { 
  calculateGridDistance,
  computeGridMoveToward, 
  calculateFacing, 
  getCombatantByPlayerId, 
  getCharacterById, 
  isDefeated,
  sendToMatch,
  checkVictory,
  getGridSystemForMatch
} from "./helpers";
import { advanceTurn } from "./rulesetHelpers";
import { getServerAdapter } from "../../shared/rulesets/serverAdapter";
import { getRulesetServerFactory } from "./rulesets";



export const createBotCharacter = (name: string, rulesetId: RulesetId): CharacterSheet => {
  const factory = getRulesetServerFactory(rulesetId);
  return factory.createDefaultCharacter(name);
};

export const createBot = async (): Promise<User> => {
  const botName = `Bot ${state.botCount++}`;
  const bot = await createUser(botName, true);
  state.users.set(bot.id, bot);
  return bot;
};

export const addBotToMatch = async (matchId: string, rulesetId: RulesetId): Promise<{ bot: User; character: CharacterSheet }> => {
  const bot = await createBot();
  const character = createBotCharacter(bot.username, rulesetId);
  await upsertCharacter(character, bot.id);
  state.characters.set(character.id, character);
  await addMatchMember(matchId, bot.id, character.id);
  return { bot, character };
};

const findNearestEnemy = (
  botCombatant: CombatantState,
  allCombatants: CombatantState[],
  botPlayerId: string,
  match: MatchState
): CombatantState | null => {
  const gridSystem = getGridSystemForMatch(match);
  let nearest: CombatantState | null = null;
  let minDistance = Infinity;
  for (const combatant of allCombatants) {
    if (combatant.playerId === botPlayerId) continue;
    if (isDefeated(combatant)) continue;
    const dist = calculateGridDistance(botCombatant.position, combatant.position, gridSystem);
    if (dist < minDistance) {
      minDistance = dist;
      nearest = combatant;
    }
  }
  return nearest;
};



export const scheduleBotTurn = (matchId: string, match: MatchState) => {
  if (match.status !== "active") return;
  
  const activePlayer = match.players.find((player) => player.id === match.activeTurnPlayerId);
  if (!activePlayer?.isBot) return;
  
  const existingTimer = state.botTimers.get(matchId);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }
  
  const timer = setTimeout(async () => {
    const currentMatch = state.matches.get(matchId);
    if (!currentMatch || currentMatch.status !== "active") return;

    const botCombatant = getCombatantByPlayerId(currentMatch, activePlayer.id);
    if (!botCombatant || botCombatant.currentHP <= 0) {
      const updated = advanceTurn({
        ...currentMatch,
        log: [...currentMatch.log, `${activePlayer.name} is incapacitated.`],
      });
      state.matches.set(matchId, updated);
      await updateMatchState(matchId, updated);
      await sendToMatch(matchId, { type: "match_state", state: updated });
      scheduleBotTurn(matchId, updated);
      return;
    }

    const target = findNearestEnemy(botCombatant, currentMatch.combatants, activePlayer.id, currentMatch);
    if (!target) {
      const updated = advanceTurn({
        ...currentMatch,
        log: [...currentMatch.log, `${activePlayer.name} finds no targets.`],
      });
      state.matches.set(matchId, updated);
      await updateMatchState(matchId, updated);
      await sendToMatch(matchId, { type: "match_state", state: updated });
      scheduleBotTurn(matchId, updated);
      return;
    }

    const gridSystem = getGridSystemForMatch(currentMatch);
    const distanceToTarget = calculateGridDistance(botCombatant.position, target.position, gridSystem);

      if (distanceToTarget <= 1) {
        const factory = getRulesetServerFactory(currentMatch.rulesetId);
        let updated = await factory.executeBotAttack(matchId, currentMatch, botCombatant, target, activePlayer);
        updated = checkVictory(updated);
        state.matches.set(matchId, updated);
        await updateMatchState(matchId, updated);
        await sendToMatch(matchId, { type: "match_state", state: updated });
        scheduleBotTurn(matchId, updated);
        return;
      }

    const botCharacter = getCharacterById(currentMatch, botCombatant.characterId);
    const maxMove = botCharacter && isPF2Character(botCharacter)
      ? Math.floor((botCharacter.derived.speed ?? 25) / 5)
      : (botCharacter?.derived.basicMove ?? 5);
    const newPosition = computeGridMoveToward(botCombatant.position, target.position, maxMove, gridSystem);
    const newFacing = calculateFacing(botCombatant.position, newPosition);

    const updatedCombatants = currentMatch.combatants.map((combatant) =>
      combatant.playerId === activePlayer.id
        ? { ...combatant, position: newPosition, facing: newFacing }
        : combatant
    );

    const updated = advanceTurn({
      ...currentMatch,
      combatants: updatedCombatants,
      log: [...currentMatch.log, `${activePlayer.name} moves to (${newPosition.x}, ${newPosition.z}).`],
    });
    state.matches.set(matchId, updated);
    await updateMatchState(matchId, updated);
    await sendToMatch(matchId, { type: "match_state", state: updated });
    scheduleBotTurn(matchId, updated);
  }, 1500);
  
  state.botTimers.set(matchId, timer);
};

export const chooseBotDefense = (
    defenderCharacter: CharacterSheet,
    defenderCombatant: CombatantState,
    rulesetId: RulesetId
  ): { defenseType: DefenseType; retreat: boolean; dodgeAndDrop: boolean } => {
    if (!isGurpsCharacter(defenderCharacter)) {
      return { defenseType: 'none', retreat: false, dodgeAndDrop: false };
    }
    if (!isGurpsCombatant(defenderCombatant)) {
      return { defenseType: 'none', retreat: false, dodgeAndDrop: false };
    }
    
    const adapter = getServerAdapter(rulesetId);
   const encumbrance = adapter.calculateEncumbrance!(
      defenderCharacter.attributes.strength,
      defenderCharacter.equipment
    );
    const effectiveDodge = defenderCharacter.derived.dodge + encumbrance.dodgePenalty;
    const options = adapter.getDefenseOptions!(defenderCharacter, effectiveDodge);
   
   const defenses: { type: DefenseType; value: number }[] = [
     { type: 'dodge', value: options.dodge }
   ];
   
   if (options.block) {
     defenses.push({ type: 'block', value: options.block.value });
   }
   
   if (options.parry) {
     const alreadyUsed = defenderCombatant.parryWeaponsUsedThisTurn.includes(options.parry.weapon);
     const parryValue = alreadyUsed ? options.parry.value - 4 : options.parry.value;
     defenses.push({ type: 'parry', value: parryValue });
   }
   
   defenses.sort((a, b) => b.value - a.value);
   const bestDefense = defenses[0];
   const canRetreat = !defenderCombatant.retreatedThisTurn;
  
  return {
    defenseType: bestDefense.type,
    retreat: canRetreat,
    dodgeAndDrop: false,
  };
};
