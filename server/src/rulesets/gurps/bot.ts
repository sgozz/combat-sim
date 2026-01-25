import type { CharacterSheet, MatchState } from "../../../../shared/types";
import type { CombatantState, DefenseType, DamageType, PendingDefense } from "../../../../shared/rulesets/gurps/types";
import type { BotAttackExecutor } from "../types";
import { getServerAdapter } from "../../../../shared/rulesets/serverAdapter";
import { advanceTurn } from "../../rulesetHelpers";
import { getCharacterById, sendToMatch, checkVictory } from "../../helpers";

const formatRoll = (r: { target: number, roll: number, success: boolean, margin: number, dice: number[] }, label: string) => 
  `(${label} ${r.target} vs ${r.roll} [${r.dice.join(', ')}]: ${r.success ? 'Made' : 'Missed'} by ${Math.abs(r.margin)})`;

export const executeBotAttack: BotAttackExecutor = async (
  matchId,
  currentMatch,
  botCombatant,
  target,
  activePlayer
) => {
  const attackerCharacter = getCharacterById(currentMatch, botCombatant.characterId);
  const targetCharacter = getCharacterById(currentMatch, target.characterId);
  if (!attackerCharacter || !targetCharacter) {
    const updated = advanceTurn({
      ...currentMatch,
      log: [...currentMatch.log, `${activePlayer.name} waits.`],
    });
    return updated;
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
    return updated;
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
    return updated;
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
    return updated;
  }

  const defense = targetCharacter.derived.dodge;
  const defenseRoll = Math.floor(Math.random() * 6) + Math.floor(Math.random() * 6) + Math.floor(Math.random() * 6) + 3;
  if (defenseRoll <= defense) {
    logEntry += `: Dodge! ${formatRoll(attackRoll.roll, 'Attack')}`;
    const updated = advanceTurn({
      ...currentMatch,
      log: [...currentMatch.log, logEntry],
    });
    return updated;
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
  return updated;
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
