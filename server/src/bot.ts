import type { CharacterSheet, MatchState, User, RulesetId } from "../../shared/types";
import { isPF2Character, isGurpsCharacter } from "../../shared/types";
import type { CombatantState } from "../../shared/rulesets";
import { isGurpsCombatant, isPF2Combatant } from "../../shared/rulesets";
import type { DefenseType } from "../../shared/rulesets/gurps/types";
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
import { decidePF2BotAction, executeBotStrike, executeBotStride, executeBotInteract } from "./rulesets/pf2/bot";
import { executeAoOStrike, resumeStrideAfterReaction } from "./handlers/pf2/reaction";
import { getTemplateById, getMonsterTemplates } from "../../shared/rulesets/templates";
import { generateUUID } from "../../shared/utils/uuid";

export const createBotCharacter = (name: string, rulesetId: RulesetId, templateId?: string): CharacterSheet => {
  if (templateId) {
    const template = getTemplateById(rulesetId, templateId);
    if (template) {
      return { ...template.data, id: generateUUID(), name } as CharacterSheet;
    }
  }
  const factory = getRulesetServerFactory(rulesetId);
  return factory.createDefaultCharacter(name);
};

const pickRandomMonsterTemplate = (rulesetId: RulesetId): string | undefined => {
  const monsters = getMonsterTemplates(rulesetId);
  if (monsters.length === 0) return undefined;
  return monsters[Math.floor(Math.random() * monsters.length)].id;
};

export const createBot = async (name?: string): Promise<User> => {
  const baseName = name ?? `Bot ${state.botCount}`;
  state.botCount++;
  const bot = await createBotUser(baseName);
  state.users.set(bot.id, bot);
  return bot;
};

const createBotUser = async (baseName: string): Promise<User> => {
  try {
    return await createUser(baseName, true);
  } catch {
    const old = state.db.prepare("SELECT id FROM users WHERE username = ? AND is_bot = 1").get(baseName) as { id: string } | undefined;
    if (old) {
      state.db.prepare("DELETE FROM match_members WHERE user_id = ?").run(old.id);
      state.db.prepare("DELETE FROM characters WHERE owner_id = ?").run(old.id);
      state.db.prepare("DELETE FROM sessions WHERE user_id = ?").run(old.id);
      state.db.prepare("UPDATE matches SET winner_id = NULL WHERE winner_id = ?").run(old.id);
      state.db.prepare("DELETE FROM users WHERE id = ?").run(old.id);
      state.users.delete(old.id);
    }
    return await createUser(baseName, true);
  }
};

export const addBotToMatch = async (matchId: string, rulesetId: RulesetId, templateId?: string): Promise<{ bot: User; character: CharacterSheet }> => {
  const resolvedTemplateId = templateId ?? pickRandomMonsterTemplate(rulesetId);
  const template = resolvedTemplateId ? getTemplateById(rulesetId, resolvedTemplateId) : undefined;
  const botName = template?.label ?? `Bot ${state.botCount}`;
  const bot = await createBot(botName);
  const character = createBotCharacter(botName, rulesetId, resolvedTemplateId);
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

    if (currentMatch.pendingReaction) {
      const pending = currentMatch.pendingReaction;
      const reactorPlayer = currentMatch.players.find(p => p.id === pending.reactorId);
      if (reactorPlayer?.isBot) {
        const reactor = currentMatch.combatants.find(c => c.playerId === pending.reactorId);
        const trigger = currentMatch.combatants.find(c => c.playerId === pending.triggerId);
        if (reactor && trigger) {
          let updated = executeAoOStrike(currentMatch, matchId, reactor, trigger);
          updated = { ...updated, pendingReaction: undefined };
          updated = await resumeStrideAfterReaction(matchId, updated, pending);
          updated = checkVictory(updated);
          state.matches.set(matchId, updated);
          await updateMatchState(matchId, updated);
          await sendToMatch(matchId, { type: "match_state", state: updated });
          scheduleBotTurn(matchId, updated);
        }
        return;
      }
      return;
    }

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

    if (currentMatch.rulesetId === 'pf2' && isPF2Combatant(botCombatant)) {
      let match = currentMatch;
      const botCharacter = getCharacterById(match, botCombatant.characterId);
      if (!botCharacter || !isPF2Character(botCharacter)) {
        const updated = advanceTurn({
          ...match,
          log: [...match.log, `${activePlayer.name} waits.`],
        });
        state.matches.set(matchId, updated);
        await updateMatchState(matchId, updated);
        await sendToMatch(matchId, { type: "match_state", state: updated });
        scheduleBotTurn(matchId, updated);
        return;
      }

      let actionsTaken = 0;
      const maxActions = 10;
      while (actionsTaken < maxActions) {
        actionsTaken++;
        const currentBot = match.combatants.find(c => c.playerId === activePlayer.id);
        if (!currentBot || !isPF2Combatant(currentBot)) break;
        if (currentBot.actionsRemaining <= 0) break;
        if (currentBot.currentHP <= 0) break;

        const action = decidePF2BotAction(match, currentBot, botCharacter);
        if (!action) break;

        if (action.type === 'strike') {
          match = executeBotStrike(matchId, match, currentBot, action.targetId, activePlayer);
        } else if (action.type === 'stride') {
          match = executeBotStride(match, currentBot, action.to, activePlayer);
        } else if (action.type === 'interact') {
          match = executeBotInteract(match, currentBot, action, activePlayer);
        } else {
          break;
        }

        match = checkVictory(match);
        if (match.status === 'finished') break;
      }

      const finalState = advanceTurn(match);
      state.matches.set(matchId, finalState);
      await updateMatchState(matchId, finalState);
      await sendToMatch(matchId, { type: "match_state", state: finalState });
      scheduleBotTurn(matchId, finalState);
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
    const newPosition = computeGridMoveToward(botCombatant.position, target.position, maxMove, gridSystem, 1, currentMatch.mapDefinition);
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
