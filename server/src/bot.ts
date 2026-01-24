import { randomUUID } from "node:crypto";
import type { CharacterSheet, MatchState, User, RulesetId } from "../../shared/types";
import type { CombatantState, DefenseType, DamageType, PendingDefense } from "../../shared/rulesets/gurps/types";
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

const formatRoll = (r: { target: number, roll: number, success: boolean, margin: number, dice: number[] }, label: string) => 
  `(${label} ${r.target} vs ${r.roll} [${r.dice.join(', ')}]: ${r.success ? 'Made' : 'Missed'} by ${Math.abs(r.margin)})`;

export const createBotCharacter = (name: string, rulesetId: RulesetId = 'gurps'): CharacterSheet => {
  const adapter = getServerAdapter(rulesetId);
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

type PF2DamageType = 'bludgeoning' | 'slashing' | 'piercing' | 'fire' | 'cold' | 'electricity' | 'acid' | 'sonic' | 'force' | 'mental' | 'poison' | 'bleed' | 'precision' | 'spirit' | 'vitality' | 'void';

const executePF2BotAttack = async (
  matchId: string,
  currentMatch: MatchState,
  botCombatant: CombatantState,
  target: CombatantState,
  activePlayer: { id: string; name: string }
): Promise<MatchState> => {
  const adapter = getServerAdapter('pf2');
  const attackerCharacter = getCharacterById(currentMatch, botCombatant.characterId);
  const targetCharacter = getCharacterById(currentMatch, target.characterId);
  
  if (!attackerCharacter || !targetCharacter) {
    return advanceTurn({
      ...currentMatch,
      log: [...currentMatch.log, `${activePlayer.name} waits.`],
    });
  }

  const weapon = attackerCharacter.equipment[0];
  const weaponName = weapon?.name ?? 'Fist';
  const weaponDamage = weapon?.damage ?? '1d4';
  const damageTypeMap: Record<string, PF2DamageType> = {
    crushing: 'bludgeoning',
    cutting: 'slashing',
    impaling: 'piercing',
    piercing: 'piercing',
  };
  const pf2DamageType: PF2DamageType = damageTypeMap[weapon?.damageType ?? 'crushing'] ?? 'bludgeoning';

  const strMod = adapter.pf2!.getAbilityModifier(attackerCharacter.attributes.strength);
  const level = 1;
  const profBonus = adapter.pf2!.getProficiencyBonus('trained', level);
  const attacksThisTurn = botCombatant.pf2?.attacksThisTurn ?? 0;
  const mapPenalty = adapter.pf2!.getMultipleAttackPenalty(attacksThisTurn + 1, false);
  const totalAttackBonus = strMod + profBonus + mapPenalty;
  
  const targetAC = targetCharacter.derived.dodge;
  const attackRoll = adapter.pf2!.rollCheck(totalAttackBonus, targetAC);
  
  let logEntry = `${attackerCharacter.name} attacks ${targetCharacter.name} with ${weaponName}`;
  if (mapPenalty < 0) {
    logEntry += ` (MAP ${mapPenalty})`;
  }
  
  const degreeLabel = attackRoll.degree === 'critical_success' ? 'Critical Hit!' 
    : attackRoll.degree === 'success' ? 'Hit' 
    : attackRoll.degree === 'failure' ? 'Miss' 
    : 'Critical Miss!';
  
  logEntry += `: [${attackRoll.roll}+${attackRoll.modifier}=${attackRoll.total} vs AC ${attackRoll.dc}] ${degreeLabel}`;

  let damageDealt = 0;
  if (attackRoll.degree === 'critical_success' || attackRoll.degree === 'success') {
    const damageRoll = adapter.pf2!.rollDamage(`${weaponDamage}+${strMod}`, pf2DamageType);
    damageDealt = attackRoll.degree === 'critical_success' ? damageRoll.total * 2 : damageRoll.total;
    logEntry += ` for ${damageDealt} ${pf2DamageType} damage`;
    if (attackRoll.degree === 'critical_success') {
      logEntry += ' (doubled)';
    }
  }

  const newActionsRemaining = (botCombatant.pf2?.actionsRemaining ?? 3) - 1;
  const newAttacksThisTurn = attacksThisTurn + 1;

  const updatedCombatants = currentMatch.combatants.map(c => {
    if (c.playerId === target.playerId && damageDealt > 0) {
      const newHP = Math.max(0, c.currentHP - damageDealt);
      return { 
        ...c, 
        currentHP: newHP,
        statusEffects: newHP <= 0 
          ? [...c.statusEffects.filter(e => e !== 'unconscious'), 'unconscious']
          : c.statusEffects,
      };
    }
    if (c.playerId === activePlayer.id) {
      return {
        ...c,
        attacksRemaining: newActionsRemaining,
        pf2: {
          actionsRemaining: newActionsRemaining,
          attacksThisTurn: newAttacksThisTurn,
          mapPenalty: adapter.pf2!.getMultipleAttackPenalty(newAttacksThisTurn + 1, false),
          reactionAvailable: c.pf2?.reactionAvailable ?? true,
          shieldRaised: c.pf2?.shieldRaised ?? false,
        },
      };
    }
    return c;
  });

  const targetAfterDamage = updatedCombatants.find(c => c.playerId === target.playerId);
  if (targetAfterDamage && targetAfterDamage.currentHP <= 0) {
    logEntry += `. ${targetCharacter.name} falls unconscious!`;
  }

  if (damageDealt > 0) {
    sendToMatch(matchId, {
      type: "visual_effect",
      matchId,
      effect: { 
        type: "damage", 
        attackerId: activePlayer.id, 
        targetId: target.playerId, 
        value: damageDealt, 
        position: target.position 
      }
    });
  } else {
    sendToMatch(matchId, {
      type: "visual_effect",
      matchId,
      effect: { 
        type: "miss", 
        attackerId: activePlayer.id, 
        targetId: target.playerId, 
        position: target.position 
      }
    });
  }

  if (newActionsRemaining <= 0) {
    return advanceTurn({
      ...currentMatch,
      combatants: updatedCombatants,
      log: [...currentMatch.log, logEntry],
    });
  } else {
    return {
      ...currentMatch,
      combatants: updatedCombatants,
      log: [...currentMatch.log, logEntry],
    };
  }
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
      if (currentMatch.rulesetId === 'pf2') {
        let updated = await executePF2BotAttack(matchId, currentMatch, botCombatant, target, activePlayer);
        updated = checkVictory(updated);
        state.matches.set(matchId, updated);
        await updateMatchState(matchId, updated);
        await sendToMatch(matchId, { type: "match_state", state: updated });
        scheduleBotTurn(matchId, updated);
        return;
      }

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
       const adapter = getServerAdapter(currentMatch.rulesetId);
       const attackRoll = adapter.resolveAttackRoll!(skill);
      
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
         const dmg = adapter.rollDamage!(damageFormula);
         const finalDamage = adapter.applyDamageMultiplier!(dmg.total, damageType);
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

       const dmg = adapter.rollDamage!(damageFormula);
       const finalDamage = adapter.applyDamageMultiplier!(dmg.total, damageType);
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
   defenderCombatant: CombatantState
 ): { defenseType: DefenseType; retreat: boolean; dodgeAndDrop: boolean } => {
   const adapter = getServerAdapter('gurps');
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
