import { randomUUID } from "node:crypto";
import type { CharacterSheet, CombatantState, MatchState, User, DefenseType, DamageType, PendingDefense } from "../../shared/types";
import { state } from "./state";
import { createUser, addMatchMember, updateMatchState, upsertCharacter } from "./db";
import { 
  calculateHexDistance, 
  computeHexMoveToward, 
  calculateFacing, 
  getCombatantByPlayerId, 
  getCharacterById, 
  isDefeated,
  sendToMatch,
  checkVictory
} from "./helpers";
import { advanceTurn, calculateDerivedStats, resolveAttackRoll, applyDamageMultiplier, getDefenseOptions, calculateEncumbrance, rollDamage } from "../../shared/rules";

const formatRoll = (r: { target: number, roll: number, success: boolean, margin: number, dice: number[] }, label: string) => 
  `(${label} ${r.target} vs ${r.roll} [${r.dice.join(', ')}]: ${r.success ? 'Made' : 'Missed'} by ${Math.abs(r.margin)})`;

export const createBotCharacter = (name: string): CharacterSheet => {
  const attributes = {
    strength: 10,
    dexterity: 10,
    intelligence: 9,
    health: 10,
  };
  return {
    id: randomUUID(),
    name,
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
    pointsTotal: 75,
  };
};

export const createBot = async (): Promise<User> => {
  const botName = `Bot ${state.botCount++}`;
  const bot = await createUser(botName, true);
  state.users.set(bot.id, bot);
  return bot;
};

export const addBotToMatch = async (matchId: string): Promise<{ bot: User; character: CharacterSheet }> => {
  const bot = await createBot();
  const character = createBotCharacter(bot.username);
  await upsertCharacter(character, bot.id);
  state.characters.set(character.id, character);
  await addMatchMember(matchId, bot.id, character.id);
  return { bot, character };
};

const findNearestEnemy = (
  botCombatant: CombatantState,
  allCombatants: CombatantState[],
  botPlayerId: string
): CombatantState | null => {
  let nearest: CombatantState | null = null;
  let minDistance = Infinity;
  for (const combatant of allCombatants) {
    if (combatant.playerId === botPlayerId) continue;
    if (isDefeated(combatant)) continue;
    const dist = calculateHexDistance(botCombatant.position, combatant.position);
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

    const target = findNearestEnemy(botCombatant, currentMatch.combatants, activePlayer.id);
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

    const distanceToTarget = calculateHexDistance(botCombatant.position, target.position);

    if (distanceToTarget <= 1) {
      const attackerCharacter = getCharacterById(currentMatch, botCombatant.characterId);
      const targetCharacter = getCharacterById(currentMatch, target.characterId);
      if (!attackerCharacter || !targetCharacter) {
        const updated = advanceTurn({
          ...currentMatch,
          log: [...currentMatch.log, `${activePlayer.name} waits.`],
        });
        state.matches.set(matchId, updated);
        await updateMatchState(matchId, updated);
        await sendToMatch(matchId, { type: "match_state", state: updated });
        scheduleBotTurn(matchId, updated);
        return;
      }

      const skill = attackerCharacter.skills[0]?.level ?? attackerCharacter.attributes.dexterity;
      const weapon = attackerCharacter.equipment[0];
      const damageFormula = weapon?.damage ?? "1d";
      const damageType: DamageType = weapon?.damageType ?? 'crushing';
      const attackRoll = resolveAttackRoll(skill);
      
      let logEntry = `${attackerCharacter.name} attacks ${targetCharacter.name}`;

      if (!attackRoll.hit) {
        logEntry += `: Miss. ${formatRoll(attackRoll.roll, 'Skill')}`;
        const updated = advanceTurn({
          ...currentMatch,
          log: [...currentMatch.log, logEntry],
        });
        state.matches.set(matchId, updated);
        await updateMatchState(matchId, updated);
        await sendToMatch(matchId, { type: "match_state", state: updated });
        scheduleBotTurn(matchId, updated);
        return;
      }

      const targetPlayer = currentMatch.players.find(p => p.id === target.playerId);
      const targetIsHuman = targetPlayer && !targetPlayer.isBot;
      
      if (attackRoll.critical) {
        const dmg = rollDamage(damageFormula);
        const finalDamage = applyDamageMultiplier(dmg.total, damageType);
        const updatedCombatants = currentMatch.combatants.map((combatant) => {
          if (combatant.playerId !== target.playerId) return combatant;
          return { ...combatant, currentHP: Math.max(combatant.currentHP - finalDamage, 0) };
        });
        logEntry += `: Critical hit for ${finalDamage} damage! ${formatRoll(attackRoll.roll, 'Attack')}`;
        let updated = advanceTurn({
          ...currentMatch,
          combatants: updatedCombatants,
          log: [...currentMatch.log, logEntry],
        });
        updated = checkVictory(updated);
        state.matches.set(matchId, updated);
        await updateMatchState(matchId, updated);
        await sendToMatch(matchId, { type: "match_state", state: updated });
        scheduleBotTurn(matchId, updated);
        return;
      }

      if (targetIsHuman) {
        const pendingDefense: PendingDefense = {
          attackerId: activePlayer.id,
          defenderId: target.playerId,
          attackRoll: attackRoll.roll.roll,
          attackMargin: attackRoll.roll.margin,
          hitLocation: 'torso',
          weapon: weapon?.name ?? 'Unarmed',
          damage: damageFormula,
          damageType,
          deceptivePenalty: 0,
          timestamp: Date.now(),
        };
        logEntry += `: ${formatRoll(attackRoll.roll, 'Attack')} - awaiting defense...`;
        const updated: MatchState = {
          ...currentMatch,
          pendingDefense,
          log: [...currentMatch.log, logEntry],
        };
        state.matches.set(matchId, updated);
        await updateMatchState(matchId, updated);
        await sendToMatch(matchId, { type: "match_state", state: updated });
        return;
      }

      const defense = targetCharacter.derived.dodge;
      const defenseRoll = Math.floor(Math.random() * 6) + Math.floor(Math.random() * 6) + Math.floor(Math.random() * 6) + 3;
      if (defenseRoll <= defense) {
        logEntry += `: Dodge! ${formatRoll(attackRoll.roll, 'Attack')}`;
        const updated = advanceTurn({
          ...currentMatch,
          log: [...currentMatch.log, logEntry],
        });
        state.matches.set(matchId, updated);
        await updateMatchState(matchId, updated);
        await sendToMatch(matchId, { type: "match_state", state: updated });
        scheduleBotTurn(matchId, updated);
        return;
      }

      const dmg = rollDamage(damageFormula);
      const finalDamage = applyDamageMultiplier(dmg.total, damageType);
      const updatedCombatants = currentMatch.combatants.map((combatant) => {
        if (combatant.playerId !== target.playerId) return combatant;
        return { ...combatant, currentHP: Math.max(combatant.currentHP - finalDamage, 0) };
      });
      logEntry += `: Hit for ${finalDamage} damage. ${formatRoll(attackRoll.roll, 'Attack')}`;
      let updated = advanceTurn({
        ...currentMatch,
        combatants: updatedCombatants,
        log: [...currentMatch.log, logEntry],
      });
      updated = checkVictory(updated);
      state.matches.set(matchId, updated);
      await updateMatchState(matchId, updated);
      await sendToMatch(matchId, { type: "match_state", state: updated });
      scheduleBotTurn(matchId, updated);
      return;
    }

    const botCharacter = getCharacterById(currentMatch, botCombatant.characterId);
    const maxMove = botCharacter?.derived.basicMove ?? 5;
    const newPosition = computeHexMoveToward(botCombatant.position, target.position, maxMove);
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
  defenderCombatant: CombatantState
): { defenseType: DefenseType; retreat: boolean; dodgeAndDrop: boolean } => {
  const encumbrance = calculateEncumbrance(
    defenderCharacter.attributes.strength,
    defenderCharacter.equipment
  );
  const effectiveDodge = defenderCharacter.derived.dodge + encumbrance.dodgePenalty;
  const options = getDefenseOptions(defenderCharacter, effectiveDodge);
  
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
