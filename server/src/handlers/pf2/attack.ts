import type { WebSocket } from "ws";
import type {
  MatchState,
  Player,
} from "../../../../shared/types";
import { isPF2Character } from "../../../../shared/types";
import type { PF2CharacterSheet, PF2CharacterWeapon } from "../../../../shared/rulesets/pf2/characterSheet";
import type { CombatActionPayload } from "../../../../shared/rulesets";
import { isPF2Combatant } from "../../../../shared/rulesets";
import { getServerAdapter } from "../../../../shared/rulesets/serverAdapter";
import { advanceTurn } from "../../rulesetHelpers";
import { state } from "../../state";
import { updateMatchState } from "../../db";
import {
  sendMessage,
  sendToMatch,
  getCombatantByPlayerId,
  getCharacterById,
  calculateGridDistance,
  getGridSystemForMatch,
  checkVictory,
} from "../../helpers";
import { scheduleBotTurn } from "../../bot";
import {
  getConditionAttackModifier,
  getConditionACModifier,
  formatConditionModifiers,
} from "../../../../shared/rulesets/pf2/conditions";
import { hasFeat } from "../../../../shared/rulesets/pf2/feats";
import { getReachableSquares, gridToHex } from "../../../../shared/rulesets/pf2/rules";

type DegreeOfSuccess = 'critical_success' | 'success' | 'failure' | 'critical_failure';
type PF2DamageType = string;

const getWeaponInfo = (character: PF2CharacterSheet): { name: string; damage: string; damageType: PF2DamageType; traits: string[]; range?: number; rangeIncrement?: number } => {
  const weapon: PF2CharacterWeapon | undefined = character.weapons[0];
  if (!weapon) {
    return {
      name: 'Fist',
      damage: '1d4',
      damageType: 'bludgeoning',
      traits: ['agile', 'finesse', 'unarmed'],
    };
  }
  
  return {
    name: weapon.name,
    damage: weapon.damage,
    damageType: weapon.damageType,
    traits: weapon.traits,
    range: weapon.range,
    rangeIncrement: weapon.rangeIncrement,
  };
};

const calculateAC = (character: PF2CharacterSheet): number => {
  return character.derived.armorClass;
};

const formatDegree = (degree: DegreeOfSuccess): string => {
  switch (degree) {
    case 'critical_success': return 'Critical Hit!';
    case 'success': return 'Hit';
    case 'failure': return 'Miss';
    case 'critical_failure': return 'Critical Miss!';
  }
};

export const handlePF2AttackAction = async (
  socket: WebSocket,
  matchId: string,
  match: MatchState,
  player: Player,
  actorCombatant: ReturnType<typeof getCombatantByPlayerId>,
  payload: CombatActionPayload & { type: "attack" }
): Promise<void> => {
  const adapter = getServerAdapter('pf2');
  if (!adapter.pf2) {
    sendMessage(socket, { type: "error", message: "PF2 adapter not available." });
    return;
  }

  if (!actorCombatant) return;
  if (!isPF2Combatant(actorCombatant)) return;

  const targetCombatant = match.combatants.find(
    (combatant) => combatant.playerId === payload.targetId
  );
  if (!targetCombatant) {
    sendMessage(socket, { type: "error", message: "Target not found." });
    return;
  }
  if (!isPF2Combatant(targetCombatant)) return;

  const attackerCharacter = getCharacterById(match, actorCombatant.characterId);
  const targetCharacter = getCharacterById(match, targetCombatant.characterId);
  if (!attackerCharacter || !targetCharacter) {
    sendMessage(socket, { type: "error", message: "Character not found." });
    return;
  }

  const pf2ActionsRemaining = actorCombatant.actionsRemaining;
  if (pf2ActionsRemaining < 1) {
    sendMessage(socket, { type: "error", message: "No actions remaining." });
    return;
  }

   if (!isPF2Character(attackerCharacter) || !isPF2Character(targetCharacter)) {
     sendMessage(socket, { type: "error", message: "PF2 attack requires PF2 characters." });
     return;
   }

    const weapon = getWeaponInfo(attackerCharacter);
    const isRanged = weapon.range !== undefined || weapon.traits.includes('thrown');
    const abilities = attackerCharacter.abilities;
    const targetAC = calculateAC(targetCharacter);

    const gridSystem = getGridSystemForMatch(match);
    const distance = calculateGridDistance(actorCombatant.position, targetCombatant.position, gridSystem);
    if (!isRanged && distance > 1) {
      sendMessage(socket, { type: "error", message: "Target out of melee range." });
      return;
    }

    let rangePenalty = 0;
    if (isRanged && weapon.range) {
      const increment = weapon.rangeIncrement || (weapon.range / 6);
      const maxRange = weapon.range;

      if (distance > maxRange) {
        sendMessage(socket, { type: "error", message: "Target out of range." });
        return;
      }

      rangePenalty = Math.floor((distance - 1) / increment) * -2;
    }

     const isFinesse = weapon.traits.includes('finesse');
    const strMod = adapter.pf2!.getAbilityModifier(abilities.strength);
    const dexMod = adapter.pf2!.getAbilityModifier(abilities.dexterity);
    const abilityMod = isRanged ? dexMod : (isFinesse ? Math.max(strMod, dexMod) : strMod);
   
     const level = attackerCharacter.level;
     const profBonus = adapter.pf2!.getProficiencyBonus('trained', level);

     const mapPenalty = actorCombatant.mapPenalty || 0;
   
    const conditionAttackMod = getConditionAttackModifier(actorCombatant);
    const totalAttackBonus = abilityMod + profBonus + mapPenalty + conditionAttackMod + rangePenalty;

    const conditionACMod = getConditionACModifier(targetCombatant, 'melee');
    const shieldBonus = targetCombatant.shieldRaised ? 2 : 0;
    const effectiveAC = targetAC + conditionACMod + shieldBonus;

    const attackRoll = adapter.pf2!.rollCheck(totalAttackBonus, effectiveAC);
   
    let logEntry = `${attackerCharacter.name} attacks ${targetCharacter.name} with ${weapon.name}`;
    if (mapPenalty < 0) {
      logEntry += ` (MAP ${mapPenalty})`;
    }
    if (rangePenalty < 0) {
      logEntry += ` (Range ${rangePenalty})`;
    }
   const conditionLogSuffix = formatConditionModifiers(conditionAttackMod, conditionACMod);
   if (conditionLogSuffix) {
     logEntry += conditionLogSuffix;
   }
   logEntry += `: [${attackRoll.roll}+${attackRoll.modifier}=${attackRoll.total} vs AC ${attackRoll.dc}] ${formatDegree(attackRoll.degree)}`;

   let damageDealt = 0;
   if (attackRoll.degree === 'critical_success' || attackRoll.degree === 'success') {
     const damageRoll = adapter.pf2!.rollDamage(`${weapon.damage}+${strMod}`, weapon.damageType);
     damageDealt = attackRoll.degree === 'critical_success' ? damageRoll.total * 2 : damageRoll.total;
    logEntry += ` for ${damageDealt} ${weapon.damageType} damage`;
    if (attackRoll.degree === 'critical_success') {
      logEntry += ' (doubled)';
    }
    logEntry += ` [${damageRoll.rolls.join('+')}${damageRoll.modifier >= 0 ? '+' : ''}${damageRoll.modifier}]`;
  }

  const updatedCombatants = match.combatants.map(c => {
    if (c.playerId === targetCombatant.playerId && damageDealt > 0) {
      const newHP = Math.max(0, c.currentHP - damageDealt);
      
      if (newHP <= 0 && isPF2Combatant(c)) {
        const newDying = 1 + c.wounded;
        const deathThreshold = 4 - c.doomed;
        const isDead = newDying >= deathThreshold;
        
        return {
          ...c,
          currentHP: newHP,
          dying: isDead ? c.dying : newDying,
          statusEffects: isDead 
            ? [...c.statusEffects.filter(e => e !== 'unconscious'), 'dead']
            : [...c.statusEffects.filter(e => e !== 'unconscious'), 'unconscious'],
          conditions: isDead
            ? c.conditions
            : [...c.conditions.filter(cond => cond.condition !== 'unconscious'), { condition: 'unconscious' as const }],
        };
      }
      
      return { 
        ...c, 
        currentHP: newHP,
        statusEffects: newHP <= 0 
          ? [...c.statusEffects.filter(e => e !== 'unconscious'), 'unconscious']
          : c.statusEffects,
      };
    }
     if (c.playerId === player.id) {
       if (!isPF2Combatant(c)) return c;
       const newActionsRemaining = c.actionsRemaining - 1;
       const isAgile = weapon.traits.includes('agile');
       const minPenalty = isAgile ? -8 : -10;
       const penaltyStep = isAgile ? -4 : -5;
       const newMapPenalty = Math.max(minPenalty, (c.mapPenalty || 0) + penaltyStep);
       return {
         ...c,
         actionsRemaining: newActionsRemaining,
         mapPenalty: newMapPenalty,
       };
     }
    return c;
  });

  const targetAfterDamage = updatedCombatants.find(c => c.playerId === targetCombatant.playerId);
  if (targetAfterDamage && targetAfterDamage.currentHP <= 0) {
    logEntry += `. ${targetCharacter.name} falls unconscious!`;
  }

  if (damageDealt > 0) {
    sendToMatch(matchId, {
      type: "visual_effect",
      matchId,
      effect: { 
        type: "damage", 
        attackerId: player.id, 
        targetId: targetCombatant.playerId, 
        value: damageDealt, 
        position: targetCombatant.position 
      }
    });
  } else {
    sendToMatch(matchId, {
      type: "visual_effect",
      matchId,
      effect: { 
        type: "miss", 
        attackerId: player.id, 
        targetId: targetCombatant.playerId, 
        position: targetCombatant.position 
      }
    });
  }

   const attackerAfterAction = updatedCombatants.find(c => c.playerId === player.id);
   const actionsLeft = (attackerAfterAction && isPF2Combatant(attackerAfterAction)) ? attackerAfterAction.actionsRemaining : 0;

  let finalState: MatchState;
  if (actionsLeft <= 0) {
    finalState = advanceTurn({
      ...match,
      combatants: updatedCombatants,
      log: [...match.log, logEntry],
    });
  } else {
    finalState = {
      ...match,
      combatants: updatedCombatants,
      log: [...match.log, logEntry, `${attackerCharacter.name} has ${actionsLeft} action(s) remaining.`],
    };
  }

  finalState = checkVictory(finalState);
  state.matches.set(matchId, finalState);
  await updateMatchState(matchId, finalState);
  sendToMatch(matchId, { type: "match_state", state: finalState });
  
  if (actionsLeft <= 0 || finalState.status === 'finished') {
    scheduleBotTurn(matchId, finalState);
  }
};

/**
 * Power Attack: 2-action melee Strike that adds +1 damage die and counts as 2 attacks for MAP.
 * 
 * Requirements:
 * - Power Attack feat
 * - 2 actions remaining
 * - Wielding melee weapon
 * 
 * Effect:
 * - Costs 2 actions
 * - Adds +1 weapon damage die (e.g., 1d8 → 2d8)
 * - Counts as 2 attacks for MAP (increment by 2 instead of 1)
 */
export const handlePF2PowerAttack = async (
  socket: WebSocket,
  matchId: string,
  match: MatchState,
  player: Player,
  actorCombatant: ReturnType<typeof getCombatantByPlayerId>,
  payload: { type: "pf2_power_attack"; targetId: string }
): Promise<void> => {
  const adapter = getServerAdapter('pf2');
  if (!adapter.pf2) {
    sendMessage(socket, { type: "error", message: "PF2 adapter not available." });
    return;
  }

  if (!actorCombatant) return;
  if (!isPF2Combatant(actorCombatant)) return;

  const attackerCharacter = getCharacterById(match, actorCombatant.characterId);
  if (!attackerCharacter || !isPF2Character(attackerCharacter)) {
    sendMessage(socket, { type: "error", message: "Character not found." });
    return;
  }

  if (!hasFeat(attackerCharacter, 'Power Attack')) {
    sendMessage(socket, { type: "error", message: "You do not have the Power Attack feat." });
    return;
  }

  const pf2ActionsRemaining = actorCombatant.actionsRemaining;
  if (pf2ActionsRemaining < 2) {
    sendMessage(socket, { type: "error", message: "Power Attack requires 2 actions." });
    return;
  }

  const targetCombatant = match.combatants.find(
    (combatant) => combatant.playerId === payload.targetId
  );
  if (!targetCombatant) {
    sendMessage(socket, { type: "error", message: "Target not found." });
    return;
  }
  if (!isPF2Combatant(targetCombatant)) return;

  const targetCharacter = getCharacterById(match, targetCombatant.characterId);
  if (!targetCharacter || !isPF2Character(targetCharacter)) {
    sendMessage(socket, { type: "error", message: "Target character not found." });
    return;
  }

  const weapon = getWeaponInfo(attackerCharacter);
  const isRanged = weapon.range !== undefined || weapon.traits.includes('thrown');
  const abilities = attackerCharacter.abilities;
  const targetAC = calculateAC(targetCharacter);

  const gridSystem = getGridSystemForMatch(match);
  const distance = calculateGridDistance(actorCombatant.position, targetCombatant.position, gridSystem);
  if (!isRanged && distance > 1) {
    sendMessage(socket, { type: "error", message: "Target out of melee range." });
    return;
  }

  let rangePenalty = 0;
  if (isRanged && weapon.range) {
    const increment = weapon.rangeIncrement || (weapon.range / 6);
    const maxRange = weapon.range;

    if (distance > maxRange) {
      sendMessage(socket, { type: "error", message: "Target out of range." });
      return;
    }

    rangePenalty = Math.floor((distance - 1) / increment) * -2;
  }

  const isFinesse = weapon.traits.includes('finesse');
  const strMod = adapter.pf2!.getAbilityModifier(abilities.strength);
  const dexMod = adapter.pf2!.getAbilityModifier(abilities.dexterity);
  const abilityMod = isRanged ? dexMod : (isFinesse ? Math.max(strMod, dexMod) : strMod);
  
  const level = attackerCharacter.level;
  const profBonus = adapter.pf2!.getProficiencyBonus('trained', level);

  const mapPenalty = actorCombatant.mapPenalty || 0;
  
  const conditionAttackMod = getConditionAttackModifier(actorCombatant);
  const totalAttackBonus = abilityMod + profBonus + mapPenalty + conditionAttackMod + rangePenalty;

  const conditionACMod = getConditionACModifier(targetCombatant, 'melee');
  const shieldBonus = targetCombatant.shieldRaised ? 2 : 0;
  const effectiveAC = targetAC + conditionACMod + shieldBonus;

  const attackRoll = adapter.pf2!.rollCheck(totalAttackBonus, effectiveAC);
  
  let logEntry = `${attackerCharacter.name} uses Power Attack ⚔️⚔️ on ${targetCharacter.name} with ${weapon.name}`;
  if (mapPenalty < 0) {
    logEntry += ` (MAP ${mapPenalty})`;
  }
  if (rangePenalty < 0) {
    logEntry += ` (Range ${rangePenalty})`;
  }
  const conditionLogSuffix = formatConditionModifiers(conditionAttackMod, conditionACMod);
  if (conditionLogSuffix) {
    logEntry += conditionLogSuffix;
  }
  logEntry += `: [${attackRoll.roll}+${attackRoll.modifier}=${attackRoll.total} vs AC ${attackRoll.dc}] ${formatDegree(attackRoll.degree)}`;

  let damageDealt = 0;
  if (attackRoll.degree === 'critical_success' || attackRoll.degree === 'success') {
    const damageMatch = weapon.damage.match(/^(\d+)d(\d+)$/);
    let enhancedDamage = weapon.damage;
    if (damageMatch) {
      const diceCount = parseInt(damageMatch[1], 10);
      const diceSize = damageMatch[2];
      enhancedDamage = `${diceCount + 1}d${diceSize}`;
    }
    
    const damageRoll = adapter.pf2!.rollDamage(`${enhancedDamage}+${strMod}`, weapon.damageType);
    damageDealt = attackRoll.degree === 'critical_success' ? damageRoll.total * 2 : damageRoll.total;
    logEntry += ` for ${damageDealt} ${weapon.damageType} damage`;
    if (attackRoll.degree === 'critical_success') {
      logEntry += ' (doubled)';
    }
    logEntry += ` [${damageRoll.rolls.join('+')}${damageRoll.modifier >= 0 ? '+' : ''}${damageRoll.modifier}]`;
  }

  const updatedCombatants = match.combatants.map(c => {
    if (c.playerId === targetCombatant.playerId && damageDealt > 0) {
      const newHP = Math.max(0, c.currentHP - damageDealt);
      
      if (newHP <= 0 && isPF2Combatant(c)) {
        const newDying = 1 + c.wounded;
        const deathThreshold = 4 - c.doomed;
        const isDead = newDying >= deathThreshold;
        
        return {
          ...c,
          currentHP: newHP,
          dying: isDead ? c.dying : newDying,
          statusEffects: isDead 
            ? [...c.statusEffects.filter(e => e !== 'unconscious'), 'dead']
            : [...c.statusEffects.filter(e => e !== 'unconscious'), 'unconscious'],
          conditions: isDead
            ? c.conditions
            : [...c.conditions.filter(cond => cond.condition !== 'unconscious'), { condition: 'unconscious' as const }],
        };
      }
      
      return { 
        ...c, 
        currentHP: newHP,
        statusEffects: newHP <= 0 
          ? [...c.statusEffects.filter(e => e !== 'unconscious'), 'unconscious']
          : c.statusEffects,
      };
    }
    if (c.playerId === player.id) {
      if (!isPF2Combatant(c)) return c;
      const newActionsRemaining = c.actionsRemaining - 2;
      const isAgile = weapon.traits.includes('agile');
      const minPenalty = isAgile ? -8 : -10;
      const penaltyStep = isAgile ? -4 : -5;
      const newMapPenalty = Math.max(minPenalty, (c.mapPenalty || 0) + (penaltyStep * 2));
      return {
        ...c,
        actionsRemaining: newActionsRemaining,
        mapPenalty: newMapPenalty,
      };
    }
    return c;
  });

  const targetAfterDamage = updatedCombatants.find(c => c.playerId === targetCombatant.playerId);
  if (targetAfterDamage && targetAfterDamage.currentHP <= 0) {
    logEntry += `. ${targetCharacter.name} falls unconscious!`;
  }

  if (damageDealt > 0) {
    sendToMatch(matchId, {
      type: "visual_effect",
      matchId,
      effect: { 
        type: "damage", 
        attackerId: player.id, 
        targetId: targetCombatant.playerId, 
        value: damageDealt, 
        position: targetCombatant.position 
      }
    });
  } else {
    sendToMatch(matchId, {
      type: "visual_effect",
      matchId,
      effect: { 
        type: "miss", 
        attackerId: player.id, 
        targetId: targetCombatant.playerId, 
        position: targetCombatant.position 
      }
    });
  }

  const attackerAfterAction = updatedCombatants.find(c => c.playerId === player.id);
  const actionsLeft = (attackerAfterAction && isPF2Combatant(attackerAfterAction)) ? attackerAfterAction.actionsRemaining : 0;

  let finalState: MatchState;
  if (actionsLeft <= 0) {
    finalState = advanceTurn({
      ...match,
      combatants: updatedCombatants,
      log: [...match.log, logEntry],
    });
  } else {
    finalState = {
      ...match,
      combatants: updatedCombatants,
      log: [...match.log, logEntry, `${attackerCharacter.name} has ${actionsLeft} action(s) remaining.`],
    };
  }

  finalState = checkVictory(finalState);
  state.matches.set(matchId, finalState);
  await updateMatchState(matchId, finalState);
  sendToMatch(matchId, { type: "match_state", state: finalState });
  
  if (actionsLeft <= 0 || finalState.status === 'finished') {
    scheduleBotTurn(matchId, finalState);
  }
};

/**
 * Sudden Charge: 2-action combo that allows Stride twice and make a melee Strike.
 * 
 * Requirements:
 * - Sudden Charge feat
 * - 2 actions remaining
 * - Destination within 2x speed
 * - Target within melee reach after movement
 * 
 * Effect:
 * - Costs 2 actions
 * - Moves up to 2x speed
 * - Makes Strike attack at destination
 * - Applies normal MAP
 */
export const handlePF2SuddenCharge = async (
  socket: WebSocket,
  matchId: string,
  match: MatchState,
  player: Player,
  actorCombatant: ReturnType<typeof getCombatantByPlayerId>,
  payload: { type: "pf2_sudden_charge"; targetHex: { q: number; r: number }; strikeTargetId: string }
): Promise<void> => {
  const adapter = getServerAdapter('pf2');
  if (!adapter.pf2) {
    sendMessage(socket, { type: "error", message: "PF2 adapter not available." });
    return;
  }

  if (!actorCombatant) return;
  if (!isPF2Combatant(actorCombatant)) return;

  const attackerCharacter = getCharacterById(match, actorCombatant.characterId);
  if (!attackerCharacter || !isPF2Character(attackerCharacter)) {
    sendMessage(socket, { type: "error", message: "Character not found." });
    return;
  }

  if (!hasFeat(attackerCharacter, 'Sudden Charge')) {
    sendMessage(socket, { type: "error", message: "You do not have the Sudden Charge feat." });
    return;
  }

  const pf2ActionsRemaining = actorCombatant.actionsRemaining;
  if (pf2ActionsRemaining < 2) {
    sendMessage(socket, { type: "error", message: "Sudden Charge requires 2 actions." });
    return;
  }

  const speed = attackerCharacter.derived.speed;
  const doubleSpeed = speed * 2;

  const startPos = gridToHex(actorCombatant.position);
  const occupiedSquares = match.combatants
    .filter(c => c.playerId !== player.id)
    .map(c => gridToHex(c.position));

  const reachable = getReachableSquares(startPos, doubleSpeed, occupiedSquares);
  const destKey = `${payload.targetHex.q},${payload.targetHex.r}`;

  if (!reachable.has(destKey)) {
    sendMessage(socket, { type: "error", message: "Destination not reachable with double Stride." });
    return;
  }

  const targetCombatant = match.combatants.find(
    (combatant) => combatant.playerId === payload.strikeTargetId
  );
  if (!targetCombatant) {
    sendMessage(socket, { type: "error", message: "Target not found." });
    return;
  }
  if (!isPF2Combatant(targetCombatant)) return;

  const targetCharacter = getCharacterById(match, targetCombatant.characterId);
  if (!targetCharacter || !isPF2Character(targetCharacter)) {
    sendMessage(socket, { type: "error", message: "Target character not found." });
    return;
  }

  const movedCombatants = match.combatants.map(c =>
    c.playerId === player.id
      ? { ...c, position: { x: payload.targetHex.q, y: c.position.y, z: payload.targetHex.r } }
      : c
  );

  const movedMatch: MatchState = {
    ...match,
    combatants: movedCombatants,
  };

  const movedActorCombatant = movedCombatants.find(c => c.playerId === player.id);
  if (!movedActorCombatant || !isPF2Combatant(movedActorCombatant)) return;

  const weapon = getWeaponInfo(attackerCharacter);
  const isRanged = weapon.range !== undefined || weapon.traits.includes('thrown');
  const abilities = attackerCharacter.abilities;
  const targetAC = calculateAC(targetCharacter);

  const gridSystem = getGridSystemForMatch(movedMatch);
  const distance = calculateGridDistance(movedActorCombatant.position, targetCombatant.position, gridSystem);
  if (!isRanged && distance > 1) {
    sendMessage(socket, { type: "error", message: "Target out of melee range after movement." });
    return;
  }

  let rangePenalty = 0;
  if (isRanged && weapon.range) {
    const increment = weapon.rangeIncrement || (weapon.range / 6);
    const maxRange = weapon.range;

    if (distance > maxRange) {
      sendMessage(socket, { type: "error", message: "Target out of range." });
      return;
    }

    rangePenalty = Math.floor((distance - 1) / increment) * -2;
  }

  const isFinesse = weapon.traits.includes('finesse');
  const strMod = adapter.pf2!.getAbilityModifier(abilities.strength);
  const dexMod = adapter.pf2!.getAbilityModifier(abilities.dexterity);
  const abilityMod = isRanged ? dexMod : (isFinesse ? Math.max(strMod, dexMod) : strMod);
  
  const level = attackerCharacter.level;
  const profBonus = adapter.pf2!.getProficiencyBonus('trained', level);

  const mapPenalty = actorCombatant.mapPenalty || 0;
  
  const conditionAttackMod = getConditionAttackModifier(actorCombatant);
  const totalAttackBonus = abilityMod + profBonus + mapPenalty + conditionAttackMod + rangePenalty;

  const conditionACMod = getConditionACModifier(targetCombatant, 'melee');
  const shieldBonus = targetCombatant.shieldRaised ? 2 : 0;
  const effectiveAC = targetAC + conditionACMod + shieldBonus;

  const attackRoll = adapter.pf2!.rollCheck(totalAttackBonus, effectiveAC);
  
  let logEntry = `${attackerCharacter.name} uses Sudden Charge ⚔️⚔️ from (${actorCombatant.position.x}, ${actorCombatant.position.z}) to (${payload.targetHex.q}, ${payload.targetHex.r}) and attacks ${targetCharacter.name} with ${weapon.name}`;
  if (mapPenalty < 0) {
    logEntry += ` (MAP ${mapPenalty})`;
  }
  if (rangePenalty < 0) {
    logEntry += ` (Range ${rangePenalty})`;
  }
  const conditionLogSuffix = formatConditionModifiers(conditionAttackMod, conditionACMod);
  if (conditionLogSuffix) {
    logEntry += conditionLogSuffix;
  }
  logEntry += `: [${attackRoll.roll}+${attackRoll.modifier}=${attackRoll.total} vs AC ${attackRoll.dc}] ${formatDegree(attackRoll.degree)}`;

  let damageDealt = 0;
  if (attackRoll.degree === 'critical_success' || attackRoll.degree === 'success') {
    const damageRoll = adapter.pf2!.rollDamage(`${weapon.damage}+${strMod}`, weapon.damageType);
    damageDealt = attackRoll.degree === 'critical_success' ? damageRoll.total * 2 : damageRoll.total;
    logEntry += ` for ${damageDealt} ${weapon.damageType} damage`;
    if (attackRoll.degree === 'critical_success') {
      logEntry += ' (doubled)';
    }
    logEntry += ` [${damageRoll.rolls.join('+')}${damageRoll.modifier >= 0 ? '+' : ''}${damageRoll.modifier}]`;
  }

  const updatedCombatants = movedCombatants.map(c => {
    if (c.playerId === targetCombatant.playerId && damageDealt > 0) {
      const newHP = Math.max(0, c.currentHP - damageDealt);
      
      if (newHP <= 0 && isPF2Combatant(c)) {
        const newDying = 1 + c.wounded;
        const deathThreshold = 4 - c.doomed;
        const isDead = newDying >= deathThreshold;
        
        return {
          ...c,
          currentHP: newHP,
          dying: isDead ? c.dying : newDying,
          statusEffects: isDead 
            ? [...c.statusEffects.filter(e => e !== 'unconscious'), 'dead']
            : [...c.statusEffects.filter(e => e !== 'unconscious'), 'unconscious'],
          conditions: isDead
            ? c.conditions
            : [...c.conditions.filter(cond => cond.condition !== 'unconscious'), { condition: 'unconscious' as const }],
        };
      }
      
      return { 
        ...c, 
        currentHP: newHP,
        statusEffects: newHP <= 0 
          ? [...c.statusEffects.filter(e => e !== 'unconscious'), 'unconscious']
          : c.statusEffects,
      };
    }
    if (c.playerId === player.id) {
      if (!isPF2Combatant(c)) return c;
      const newActionsRemaining = c.actionsRemaining - 2;
      const isAgile = weapon.traits.includes('agile');
      const minPenalty = isAgile ? -8 : -10;
      const penaltyStep = isAgile ? -4 : -5;
      const newMapPenalty = Math.max(minPenalty, (c.mapPenalty || 0) + penaltyStep);
      return {
        ...c,
        actionsRemaining: newActionsRemaining,
        mapPenalty: newMapPenalty,
      };
    }
    return c;
  });

  const targetAfterDamage = updatedCombatants.find(c => c.playerId === targetCombatant.playerId);
  if (targetAfterDamage && targetAfterDamage.currentHP <= 0) {
    logEntry += `. ${targetCharacter.name} falls unconscious!`;
  }

  if (damageDealt > 0) {
    sendToMatch(matchId, {
      type: "visual_effect",
      matchId,
      effect: { 
        type: "damage", 
        attackerId: player.id, 
        targetId: targetCombatant.playerId, 
        value: damageDealt, 
        position: targetCombatant.position 
      }
    });
  } else {
    sendToMatch(matchId, {
      type: "visual_effect",
      matchId,
      effect: { 
        type: "miss", 
        attackerId: player.id, 
        targetId: targetCombatant.playerId, 
        position: targetCombatant.position 
      }
    });
  }

  const attackerAfterAction = updatedCombatants.find(c => c.playerId === player.id);
  const actionsLeft = (attackerAfterAction && isPF2Combatant(attackerAfterAction)) ? attackerAfterAction.actionsRemaining : 0;

  let finalState: MatchState;
  if (actionsLeft <= 0) {
    finalState = advanceTurn({
      ...movedMatch,
      combatants: updatedCombatants,
      log: [...movedMatch.log, logEntry],
    });
  } else {
    finalState = {
      ...movedMatch,
      combatants: updatedCombatants,
      log: [...movedMatch.log, logEntry, `${attackerCharacter.name} has ${actionsLeft} action(s) remaining.`],
    };
  }

  finalState = checkVictory(finalState);
  state.matches.set(matchId, finalState);
  await updateMatchState(matchId, finalState);
  sendToMatch(matchId, { type: "match_state", state: finalState });
  
  if (actionsLeft <= 0 || finalState.status === 'finished') {
    scheduleBotTurn(matchId, finalState);
  }
};

/**
 * Combat Grab: 1-action Strike that automatically attempts Grapple on hit.
 * 
 * Requirements:
 * - Combat Grab feat
 * - 1 action remaining
 * - Wielding melee weapon
 * 
 * Effect:
 * - Costs 1 action (normal Strike cost)
 * - Makes Strike attack
 * - On hit: automatically attempts Grapple (applies grabbed condition)
 */
export const handlePF2CombatGrab = async (
  socket: WebSocket,
  matchId: string,
  match: MatchState,
  player: Player,
  actorCombatant: ReturnType<typeof getCombatantByPlayerId>,
  payload: { type: "pf2_combat_grab"; targetId: string }
): Promise<void> => {
  const adapter = getServerAdapter('pf2');
  if (!adapter.pf2) {
    sendMessage(socket, { type: "error", message: "PF2 adapter not available." });
    return;
  }

  if (!actorCombatant) return;
  if (!isPF2Combatant(actorCombatant)) return;

  const attackerCharacter = getCharacterById(match, actorCombatant.characterId);
  if (!attackerCharacter || !isPF2Character(attackerCharacter)) {
    sendMessage(socket, { type: "error", message: "Character not found." });
    return;
  }

  if (!hasFeat(attackerCharacter, 'Combat Grab')) {
    sendMessage(socket, { type: "error", message: "You do not have the Combat Grab feat." });
    return;
  }

  const pf2ActionsRemaining = actorCombatant.actionsRemaining;
  if (pf2ActionsRemaining < 1) {
    sendMessage(socket, { type: "error", message: "No actions remaining." });
    return;
  }

  const targetCombatant = match.combatants.find(
    (combatant) => combatant.playerId === payload.targetId
  );
  if (!targetCombatant) {
    sendMessage(socket, { type: "error", message: "Target not found." });
    return;
  }
  if (!isPF2Combatant(targetCombatant)) return;

  const targetCharacter = getCharacterById(match, targetCombatant.characterId);
  if (!targetCharacter || !isPF2Character(targetCharacter)) {
    sendMessage(socket, { type: "error", message: "Target character not found." });
    return;
  }

  const weapon = getWeaponInfo(attackerCharacter);
  const isRanged = weapon.range !== undefined || weapon.traits.includes('thrown');
  const abilities = attackerCharacter.abilities;
  const targetAC = calculateAC(targetCharacter);

  const gridSystem = getGridSystemForMatch(match);
  const distance = calculateGridDistance(actorCombatant.position, targetCombatant.position, gridSystem);
  if (!isRanged && distance > 1) {
    sendMessage(socket, { type: "error", message: "Target out of melee range." });
    return;
  }

  let rangePenalty = 0;
  if (isRanged && weapon.range) {
    const increment = weapon.rangeIncrement || (weapon.range / 6);
    const maxRange = weapon.range;

    if (distance > maxRange) {
      sendMessage(socket, { type: "error", message: "Target out of range." });
      return;
    }

    rangePenalty = Math.floor((distance - 1) / increment) * -2;
  }

  const isFinesse = weapon.traits.includes('finesse');
  const strMod = adapter.pf2!.getAbilityModifier(abilities.strength);
  const dexMod = adapter.pf2!.getAbilityModifier(abilities.dexterity);
  const abilityMod = isRanged ? dexMod : (isFinesse ? Math.max(strMod, dexMod) : strMod);
  
  const level = attackerCharacter.level;
  const profBonus = adapter.pf2!.getProficiencyBonus('trained', level);

  const mapPenalty = actorCombatant.mapPenalty || 0;
  
  const conditionAttackMod = getConditionAttackModifier(actorCombatant);
  const totalAttackBonus = abilityMod + profBonus + mapPenalty + conditionAttackMod + rangePenalty;

  const conditionACMod = getConditionACModifier(targetCombatant, 'melee');
  const shieldBonus = targetCombatant.shieldRaised ? 2 : 0;
  const effectiveAC = targetAC + conditionACMod + shieldBonus;

  const attackRoll = adapter.pf2!.rollCheck(totalAttackBonus, effectiveAC);
  
  let logEntry = `${attackerCharacter.name} uses Combat Grab ⚔️ on ${targetCharacter.name} with ${weapon.name}`;
  if (mapPenalty < 0) {
    logEntry += ` (MAP ${mapPenalty})`;
  }
  if (rangePenalty < 0) {
    logEntry += ` (Range ${rangePenalty})`;
  }
  const conditionLogSuffix = formatConditionModifiers(conditionAttackMod, conditionACMod);
  if (conditionLogSuffix) {
    logEntry += conditionLogSuffix;
  }
  logEntry += `: [${attackRoll.roll}+${attackRoll.modifier}=${attackRoll.total} vs AC ${attackRoll.dc}] ${formatDegree(attackRoll.degree)}`;

  let damageDealt = 0;
  if (attackRoll.degree === 'critical_success' || attackRoll.degree === 'success') {
    const damageRoll = adapter.pf2!.rollDamage(`${weapon.damage}+${strMod}`, weapon.damageType);
    damageDealt = attackRoll.degree === 'critical_success' ? damageRoll.total * 2 : damageRoll.total;
    logEntry += ` for ${damageDealt} ${weapon.damageType} damage`;
    if (attackRoll.degree === 'critical_success') {
      logEntry += ' (doubled)';
    }
    logEntry += ` [${damageRoll.rolls.join('+')}${damageRoll.modifier >= 0 ? '+' : ''}${damageRoll.modifier}]`;
  }

  const updatedCombatants = match.combatants.map(c => {
    if (c.playerId === targetCombatant.playerId && damageDealt > 0) {
      const newHP = Math.max(0, c.currentHP - damageDealt);
      
      if (newHP <= 0 && isPF2Combatant(c)) {
        const newDying = 1 + c.wounded;
        const deathThreshold = 4 - c.doomed;
        const isDead = newDying >= deathThreshold;
        
        return {
          ...c,
          currentHP: newHP,
          dying: isDead ? c.dying : newDying,
          statusEffects: isDead 
            ? [...c.statusEffects.filter(e => e !== 'unconscious'), 'dead']
            : [...c.statusEffects.filter(e => e !== 'unconscious'), 'unconscious'],
          conditions: isDead
            ? c.conditions
            : [...c.conditions.filter(cond => cond.condition !== 'unconscious'), { condition: 'unconscious' as const }],
        };
      }
      
      return { 
        ...c, 
        currentHP: newHP,
        statusEffects: newHP <= 0 
          ? [...c.statusEffects.filter(e => e !== 'unconscious'), 'unconscious']
          : c.statusEffects,
      };
    }
    if (c.playerId === player.id) {
      if (!isPF2Combatant(c)) return c;
      const newActionsRemaining = c.actionsRemaining - 1;
      const isAgile = weapon.traits.includes('agile');
      const minPenalty = isAgile ? -8 : -10;
      const penaltyStep = isAgile ? -4 : -5;
      const newMapPenalty = Math.max(minPenalty, (c.mapPenalty || 0) + penaltyStep);
      return {
        ...c,
        actionsRemaining: newActionsRemaining,
        mapPenalty: newMapPenalty,
      };
    }
    return c;
  });

  // Apply grabbed condition on hit
  let finalCombatants = updatedCombatants;
  if (attackRoll.degree === 'critical_success' || attackRoll.degree === 'success') {
    finalCombatants = updatedCombatants.map(c => {
      if (c.playerId === targetCombatant.playerId && isPF2Combatant(c)) {
        logEntry += `. Target is grabbed!`;
        return {
          ...c,
          conditions: [...c.conditions, { condition: 'grabbed' as const }],
        };
      }
      return c;
    });
  }

  const targetAfterDamage = finalCombatants.find(c => c.playerId === targetCombatant.playerId);
  if (targetAfterDamage && targetAfterDamage.currentHP <= 0) {
    logEntry += `. ${targetCharacter.name} falls unconscious!`;
  }

  if (damageDealt > 0) {
    sendToMatch(matchId, {
      type: "visual_effect",
      matchId,
      effect: { 
        type: "damage", 
        attackerId: player.id, 
        targetId: targetCombatant.playerId, 
        value: damageDealt, 
        position: targetCombatant.position 
      }
    });
  } else {
    sendToMatch(matchId, {
      type: "visual_effect",
      matchId,
      effect: { 
        type: "miss", 
        attackerId: player.id, 
        targetId: targetCombatant.playerId, 
        position: targetCombatant.position 
      }
    });
  }

  const attackerAfterAction = finalCombatants.find(c => c.playerId === player.id);
  const actionsLeft = (attackerAfterAction && isPF2Combatant(attackerAfterAction)) ? attackerAfterAction.actionsRemaining : 0;

  let finalState: MatchState;
  if (actionsLeft <= 0) {
    finalState = advanceTurn({
      ...match,
      combatants: finalCombatants,
      log: [...match.log, logEntry],
    });
  } else {
    finalState = {
      ...match,
      combatants: finalCombatants,
      log: [...match.log, logEntry, `${attackerCharacter.name} has ${actionsLeft} action(s) remaining.`],
    };
  }

  finalState = checkVictory(finalState);
  state.matches.set(matchId, finalState);
  await updateMatchState(matchId, finalState);
  sendToMatch(matchId, { type: "match_state", state: finalState });
  
  if (actionsLeft <= 0 || finalState.status === 'finished') {
    scheduleBotTurn(matchId, finalState);
  }
};

/**
 * Intimidating Strike: 2-action combo that makes a Strike and applies frightened on hit.
 * 
 * Requirements:
 * - Intimidating Strike feat
 * - 2 actions remaining
 * - Wielding melee weapon
 * 
 * Effect:
 * - Costs 2 actions
 * - Makes Strike attack
 * - On hit: target becomes frightened 1
 * - On critical hit: target becomes frightened 2
 */
export const handlePF2IntimidatingStrike = async (
  socket: WebSocket,
  matchId: string,
  match: MatchState,
  player: Player,
  actorCombatant: ReturnType<typeof getCombatantByPlayerId>,
  payload: { type: "pf2_intimidating_strike"; targetId: string }
): Promise<void> => {
  const adapter = getServerAdapter('pf2');
  if (!adapter.pf2) {
    sendMessage(socket, { type: "error", message: "PF2 adapter not available." });
    return;
  }

  if (!actorCombatant) return;
  if (!isPF2Combatant(actorCombatant)) return;

  const attackerCharacter = getCharacterById(match, actorCombatant.characterId);
  if (!attackerCharacter || !isPF2Character(attackerCharacter)) {
    sendMessage(socket, { type: "error", message: "Character not found." });
    return;
  }

  if (!hasFeat(attackerCharacter, 'Intimidating Strike')) {
    sendMessage(socket, { type: "error", message: "You do not have the Intimidating Strike feat." });
    return;
  }

  const pf2ActionsRemaining = actorCombatant.actionsRemaining;
  if (pf2ActionsRemaining < 2) {
    sendMessage(socket, { type: "error", message: "Intimidating Strike requires 2 actions." });
    return;
  }

  const targetCombatant = match.combatants.find(
    (combatant) => combatant.playerId === payload.targetId
  );
  if (!targetCombatant) {
    sendMessage(socket, { type: "error", message: "Target not found." });
    return;
  }
  if (!isPF2Combatant(targetCombatant)) return;

  const targetCharacter = getCharacterById(match, targetCombatant.characterId);
  if (!targetCharacter || !isPF2Character(targetCharacter)) {
    sendMessage(socket, { type: "error", message: "Target character not found." });
    return;
  }

  const weapon = getWeaponInfo(attackerCharacter);
  const isRanged = weapon.range !== undefined || weapon.traits.includes('thrown');
  const abilities = attackerCharacter.abilities;
  const targetAC = calculateAC(targetCharacter);

  const gridSystem = getGridSystemForMatch(match);
  const distance = calculateGridDistance(actorCombatant.position, targetCombatant.position, gridSystem);
  if (!isRanged && distance > 1) {
    sendMessage(socket, { type: "error", message: "Target out of melee range." });
    return;
  }

  let rangePenalty = 0;
  if (isRanged && weapon.range) {
    const increment = weapon.rangeIncrement || (weapon.range / 6);
    const maxRange = weapon.range;

    if (distance > maxRange) {
      sendMessage(socket, { type: "error", message: "Target out of range." });
      return;
    }

    rangePenalty = Math.floor((distance - 1) / increment) * -2;
  }

  const isFinesse = weapon.traits.includes('finesse');
  const strMod = adapter.pf2!.getAbilityModifier(abilities.strength);
  const dexMod = adapter.pf2!.getAbilityModifier(abilities.dexterity);
  const abilityMod = isRanged ? dexMod : (isFinesse ? Math.max(strMod, dexMod) : strMod);
  
  const level = attackerCharacter.level;
  const profBonus = adapter.pf2!.getProficiencyBonus('trained', level);

  const mapPenalty = actorCombatant.mapPenalty || 0;
  
  const conditionAttackMod = getConditionAttackModifier(actorCombatant);
  const totalAttackBonus = abilityMod + profBonus + mapPenalty + conditionAttackMod + rangePenalty;

  const conditionACMod = getConditionACModifier(targetCombatant, 'melee');
  const shieldBonus = targetCombatant.shieldRaised ? 2 : 0;
  const effectiveAC = targetAC + conditionACMod + shieldBonus;

  const attackRoll = adapter.pf2!.rollCheck(totalAttackBonus, effectiveAC);
  
  let logEntry = `${attackerCharacter.name} uses Intimidating Strike ⚔️⚔️ on ${targetCharacter.name} with ${weapon.name}`;
  if (mapPenalty < 0) {
    logEntry += ` (MAP ${mapPenalty})`;
  }
  if (rangePenalty < 0) {
    logEntry += ` (Range ${rangePenalty})`;
  }
  const conditionLogSuffix = formatConditionModifiers(conditionAttackMod, conditionACMod);
  if (conditionLogSuffix) {
    logEntry += conditionLogSuffix;
  }
  logEntry += `: [${attackRoll.roll}+${attackRoll.modifier}=${attackRoll.total} vs AC ${attackRoll.dc}] ${formatDegree(attackRoll.degree)}`;

  let damageDealt = 0;
  if (attackRoll.degree === 'critical_success' || attackRoll.degree === 'success') {
    const damageRoll = adapter.pf2!.rollDamage(`${weapon.damage}+${strMod}`, weapon.damageType);
    damageDealt = attackRoll.degree === 'critical_success' ? damageRoll.total * 2 : damageRoll.total;
    logEntry += ` for ${damageDealt} ${weapon.damageType} damage`;
    if (attackRoll.degree === 'critical_success') {
      logEntry += ' (doubled)';
    }
    logEntry += ` [${damageRoll.rolls.join('+')}${damageRoll.modifier >= 0 ? '+' : ''}${damageRoll.modifier}]`;
  }

  const updatedCombatants = match.combatants.map(c => {
    if (c.playerId === targetCombatant.playerId && damageDealt > 0) {
      const newHP = Math.max(0, c.currentHP - damageDealt);
      
      if (newHP <= 0 && isPF2Combatant(c)) {
        const newDying = 1 + c.wounded;
        const deathThreshold = 4 - c.doomed;
        const isDead = newDying >= deathThreshold;
        
        return {
          ...c,
          currentHP: newHP,
          dying: isDead ? c.dying : newDying,
          statusEffects: isDead 
            ? [...c.statusEffects.filter(e => e !== 'unconscious'), 'dead']
            : [...c.statusEffects.filter(e => e !== 'unconscious'), 'unconscious'],
          conditions: isDead
            ? c.conditions
            : [...c.conditions.filter(cond => cond.condition !== 'unconscious'), { condition: 'unconscious' as const }],
        };
      }
      
      return { 
        ...c, 
        currentHP: newHP,
        statusEffects: newHP <= 0 
          ? [...c.statusEffects.filter(e => e !== 'unconscious'), 'unconscious']
          : c.statusEffects,
      };
    }
    if (c.playerId === player.id) {
      if (!isPF2Combatant(c)) return c;
      const newActionsRemaining = c.actionsRemaining - 2;
      const isAgile = weapon.traits.includes('agile');
      const minPenalty = isAgile ? -8 : -10;
      const penaltyStep = isAgile ? -4 : -5;
      const newMapPenalty = Math.max(minPenalty, (c.mapPenalty || 0) + penaltyStep);
      return {
        ...c,
        actionsRemaining: newActionsRemaining,
        mapPenalty: newMapPenalty,
      };
    }
    return c;
  });

  // Apply frightened condition on hit
  let finalCombatants = updatedCombatants;
  if (attackRoll.degree === 'critical_success' || attackRoll.degree === 'success') {
    const frightenedValue = attackRoll.degree === 'critical_success' ? 2 : 1;
    finalCombatants = updatedCombatants.map(c => {
      if (c.playerId === targetCombatant.playerId && isPF2Combatant(c)) {
        logEntry += `. Target is frightened ${frightenedValue}!`;
        return {
          ...c,
          conditions: [...c.conditions, { condition: 'frightened' as const, value: frightenedValue }],
        };
      }
      return c;
    });
  }

  const targetAfterDamage = finalCombatants.find(c => c.playerId === targetCombatant.playerId);
  if (targetAfterDamage && targetAfterDamage.currentHP <= 0) {
    logEntry += `. ${targetCharacter.name} falls unconscious!`;
  }

  if (damageDealt > 0) {
    sendToMatch(matchId, {
      type: "visual_effect",
      matchId,
      effect: { 
        type: "damage", 
        attackerId: player.id, 
        targetId: targetCombatant.playerId, 
        value: damageDealt, 
        position: targetCombatant.position 
      }
    });
  } else {
    sendToMatch(matchId, {
      type: "visual_effect",
      matchId,
      effect: { 
        type: "miss", 
        attackerId: player.id, 
        targetId: targetCombatant.playerId, 
        position: targetCombatant.position 
      }
    });
  }

  const attackerAfterAction = finalCombatants.find(c => c.playerId === player.id);
  const actionsLeft = (attackerAfterAction && isPF2Combatant(attackerAfterAction)) ? attackerAfterAction.actionsRemaining : 0;

  let finalState: MatchState;
  if (actionsLeft <= 0) {
    finalState = advanceTurn({
      ...match,
      combatants: finalCombatants,
      log: [...match.log, logEntry],
    });
  } else {
    finalState = {
      ...match,
      combatants: finalCombatants,
      log: [...match.log, logEntry, `${attackerCharacter.name} has ${actionsLeft} action(s) remaining.`],
    };
  }

  finalState = checkVictory(finalState);
  state.matches.set(matchId, finalState);
  await updateMatchState(matchId, finalState);
  sendToMatch(matchId, { type: "match_state", state: finalState });
  
  if (actionsLeft <= 0 || finalState.status === 'finished') {
    scheduleBotTurn(matchId, finalState);
  }
};
