import type { MatchState } from "../../../../shared/types";
import type { PF2CharacterSheet } from "../../../../shared/rulesets/pf2/characterSheet";
import type { CombatantState } from "../../../../shared/rulesets/gurps/types";
import type { PF2DamageType } from "../../../../shared/rulesets/pf2/types";
import type { BotAttackExecutor } from "../types";
import { getServerAdapter } from "../../../../shared/rulesets/serverAdapter";
import { advanceTurn } from "../../rulesetHelpers";
import { getCharacterById, sendToMatch } from "../../helpers";

const asPF2Character = (match: MatchState, characterId: string): PF2CharacterSheet | undefined => {
  return getCharacterById(match, characterId) as PF2CharacterSheet | undefined;
};

export const executeBotAttack: BotAttackExecutor = async (
  matchId: string,
  currentMatch: MatchState,
  botCombatant: CombatantState,
  target: CombatantState,
  activePlayer: { id: string; name: string }
): Promise<MatchState> => {
  const adapter = getServerAdapter('pf2');
  const attackerCharacter = asPF2Character(currentMatch, botCombatant.characterId);
  const targetCharacter = asPF2Character(currentMatch, target.characterId);
  
  if (!attackerCharacter || !targetCharacter) {
    return advanceTurn({
      ...currentMatch,
      log: [...currentMatch.log, `${activePlayer.name} waits.`],
    });
  }

  const weapon = attackerCharacter.weapons[0];
  const weaponName = weapon?.name ?? 'Fist';
  const weaponDamage = weapon?.damage ?? '1d4';
  const pf2DamageType: string = weapon?.damageType ?? 'bludgeoning';

  const strMod = adapter.pf2!.getAbilityModifier(attackerCharacter.abilities.strength);
  const level = attackerCharacter.level;
  const profBonus = adapter.pf2!.getProficiencyBonus('trained', level);
  const attacksThisTurn = botCombatant.pf2?.attacksThisTurn ?? 0;
  const mapPenalty = adapter.pf2!.getMultipleAttackPenalty(attacksThisTurn + 1, false);
  const totalAttackBonus = strMod + profBonus + mapPenalty;
  
  const targetAC = targetCharacter.derived.armorClass;
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
