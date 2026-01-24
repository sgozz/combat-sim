import type { WebSocket } from "ws";
import type {
  MatchState,
  Player,
} from "../../../shared/types";
import type { CombatActionPayload } from "../../../shared/rulesets/gurps/types";
import { getServerAdapter } from "../../../shared/rulesets/serverAdapter";
import { advanceTurn } from "../rulesetHelpers";
import { state } from "../state";
import { updateMatchState } from "../db";
import {
  sendMessage,
  sendToMatch,
  getCombatantByPlayerId,
  getCharacterById,
  calculateGridDistance,
  getGridSystemForMatch,
  checkVictory,
} from "../helpers";
import { scheduleBotTurn } from "../bot";

type DegreeOfSuccess = 'critical_success' | 'success' | 'failure' | 'critical_failure';
type PF2DamageType = string;

const getPF2Abilities = (attributes: { strength: number; dexterity: number; intelligence: number; health: number; wisdom?: number; charisma?: number }) => ({
  strength: attributes.strength,
  dexterity: attributes.dexterity,
  constitution: attributes.health,
  intelligence: attributes.intelligence,
  wisdom: attributes.wisdom ?? 10,
  charisma: attributes.charisma ?? 10,
});

const getWeaponInfo = (character: { equipment: { name: string; damage?: string; damageType?: string }[] }) => {
  const weapon = character.equipment[0];
  if (!weapon) {
    return {
      name: 'Fist',
      damage: '1d4',
      damageType: 'bludgeoning' as PF2DamageType,
      traits: ['agile', 'finesse', 'unarmed'] as string[],
    };
  }
  
  const damageTypeMap: Record<string, PF2DamageType> = {
    crushing: 'bludgeoning',
    cutting: 'slashing',
    impaling: 'piercing',
    piercing: 'piercing',
  };
  
  return {
    name: weapon.name,
    damage: weapon.damage ?? '1d4',
    damageType: damageTypeMap[weapon.damageType ?? 'crushing'] ?? 'bludgeoning',
    traits: [] as string[],
  };
};

const calculateAC = (character: { derived: { dodge: number } }) => {
  return character.derived.dodge;
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

  const targetCombatant = match.combatants.find(
    (combatant) => combatant.playerId === payload.targetId
  );
  if (!targetCombatant) {
    sendMessage(socket, { type: "error", message: "Target not found." });
    return;
  }

  const attackerCharacter = getCharacterById(match, actorCombatant.characterId);
  const targetCharacter = getCharacterById(match, targetCombatant.characterId);
  if (!attackerCharacter || !targetCharacter) {
    sendMessage(socket, { type: "error", message: "Character not found." });
    return;
  }

  const gridSystem = getGridSystemForMatch(match);
  const distance = calculateGridDistance(actorCombatant.position, targetCombatant.position, gridSystem);
  if (distance > 1) {
    sendMessage(socket, { type: "error", message: "Target out of melee range." });
    return;
  }

  const pf2ActionsRemaining = actorCombatant.pf2?.actionsRemaining ?? actorCombatant.attacksRemaining;
  if (pf2ActionsRemaining < 1) {
    sendMessage(socket, { type: "error", message: "No actions remaining." });
    return;
  }

  const weapon = getWeaponInfo(attackerCharacter);
  const abilities = getPF2Abilities(attackerCharacter.attributes);
  const targetAC = calculateAC(targetCharacter);

   const isFinesse = weapon.traits.includes('finesse');
   const strMod = adapter.pf2!.getAbilityModifier(abilities.strength);
   const dexMod = adapter.pf2!.getAbilityModifier(abilities.dexterity);
   const abilityMod = isFinesse ? Math.max(strMod, dexMod) : strMod;
  
   const level = 1;
   const profBonus = adapter.pf2!.getProficiencyBonus('trained', level);
  
   const attackNumber = actorCombatant.pf2?.attacksThisTurn ?? 0;
   const isAgile = weapon.traits.includes('agile');
   const mapPenalty = adapter.pf2!.getMultipleAttackPenalty(attackNumber + 1, isAgile);
  
   const totalAttackBonus = abilityMod + profBonus + mapPenalty;

   const attackRoll = adapter.pf2!.rollCheck(totalAttackBonus, targetAC);
  
  let logEntry = `${attackerCharacter.name} attacks ${targetCharacter.name} with ${weapon.name}`;
  if (mapPenalty < 0) {
    logEntry += ` (MAP ${mapPenalty})`;
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
      return { 
        ...c, 
        currentHP: newHP,
        statusEffects: newHP <= 0 
          ? [...c.statusEffects.filter(e => e !== 'unconscious'), 'unconscious']
          : c.statusEffects,
      };
    }
    if (c.playerId === player.id) {
      const newActionsRemaining = (c.pf2?.actionsRemaining ?? c.attacksRemaining) - 1;
      const newAttacksThisTurn = (c.pf2?.attacksThisTurn ?? 0) + 1;
      return {
        ...c,
        attacksRemaining: newActionsRemaining,
       pf2: {
           actionsRemaining: newActionsRemaining,
           attacksThisTurn: newAttacksThisTurn,
           mapPenalty: adapter.pf2!.getMultipleAttackPenalty(newAttacksThisTurn + 1, isAgile),
           reactionAvailable: c.pf2?.reactionAvailable ?? true,
           shieldRaised: c.pf2?.shieldRaised ?? false,
         },
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
  const actionsLeft = attackerAfterAction?.pf2?.actionsRemaining ?? attackerAfterAction?.attacksRemaining ?? 0;

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
