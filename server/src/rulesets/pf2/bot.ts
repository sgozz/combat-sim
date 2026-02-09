import type { MatchState } from "../../../../shared/types";
import type { PF2CharacterSheet } from "../../../../shared/rulesets/pf2/characterSheet";
import type { PF2CombatantState } from "../../../../shared/rulesets/pf2/types";
import type { CombatantState } from "../../../../shared/rulesets";
import { isPF2Combatant } from "../../../../shared/rulesets";

import type { BotAttackExecutor } from "../types";
import { getServerAdapter } from "../../../../shared/rulesets/serverAdapter";
import { advanceTurn } from "../../rulesetHelpers";
import {
  getCharacterById,
  sendToMatch,
  calculateGridDistance,
  getGridSystemForMatch,
  isDefeated,
  computeGridMoveToward,
  calculateFacing,
} from "../../helpers";
import { isPF2Character } from "../../../../shared/rulesets/characterSheet";
import { isBlocked } from "../../../../shared/map/terrain";

const asPF2Character = (match: MatchState, characterId: string): PF2CharacterSheet | undefined => {
  const char = getCharacterById(match, characterId);
  return (char && isPF2Character(char)) ? char : undefined;
};

export type PF2BotAction =
  | { type: 'strike'; targetId: string }
  | { type: 'stride'; to: { q: number; r: number } }
  | { type: 'interact'; action: 'draw'; itemId: string; targetSlot: 'right_hand' | 'left_hand' }
  | { type: 'end_turn' };

export const decidePF2BotAction = (
  match: MatchState,
  botCombatant: PF2CombatantState,
  _character: PF2CharacterSheet
): PF2BotAction | null => {
  if (botCombatant.actionsRemaining < 1) return null;

  const gridSystem = getGridSystemForMatch(match);
  const enemies = match.combatants.filter(
    c => c.playerId !== botCombatant.playerId && !isDefeated(c)
  );
  if (enemies.length === 0) return null;

  const character = _character ?? asPF2Character(match, botCombatant.characterId);

  const equippedWeapon = botCombatant.equipped?.find(e => e.ready && (e.slot === 'right_hand' || e.slot === 'left_hand'));
  const weapon = equippedWeapon
    ? character?.weapons.find(w => w.id === equippedWeapon.equipmentId) ?? character?.weapons[0]
    : character?.weapons[0];

  if (character && character.weapons.length > 0 && !equippedWeapon) {
    const rightOccupied = botCombatant.equipped?.some(e => e.slot === 'right_hand' && e.ready);
    const targetSlot = rightOccupied ? 'left_hand' as const : 'right_hand' as const;
    return { type: 'interact', action: 'draw', itemId: character.weapons[0].id, targetSlot };
  }

  const isRanged = weapon?.range !== undefined || weapon?.traits?.includes('thrown');
  const weaponRange = weapon?.range ?? 0;
  const rangeIncrement = weapon?.rangeIncrement ?? (weaponRange / 6);
  const maxRange = weaponRange;

  let nearest: CombatantState = enemies[0];
  let minDistance = calculateGridDistance(botCombatant.position, nearest.position, gridSystem);
  for (const enemy of enemies) {
    const dist = calculateGridDistance(botCombatant.position, enemy.position, gridSystem);
    if (dist < minDistance) {
      minDistance = dist;
      nearest = enemy;
    }
  }

  const distance = minDistance;

  // Melee range attack
  if (distance <= 1) {
    const mapPenalty = botCombatant.mapPenalty || 0;
    if (mapPenalty > -10) {
      return { type: 'strike', targetId: nearest.playerId };
    }
    return null;
  }

  // Ranged attack if weapon has range and target is within max range
  if (isRanged && maxRange > 0 && distance <= maxRange) {
    // Calculate range penalty: -2 per increment beyond first
    const rangePenalty = Math.floor((distance - 1) / rangeIncrement) * -2;
    // Only attack if penalty is not too severe (max -10)
    if (rangePenalty >= -10) {
      const mapPenalty = botCombatant.mapPenalty || 0;
      if (mapPenalty > -10) {
        return { type: 'strike', targetId: nearest.playerId };
      }
    }
  }

  // Move toward enemy if not in range
  const speed = character.derived.speed ?? 25;
  const maxSquares = Math.floor(speed / 5);
  const newPosition = computeGridMoveToward(
    botCombatant.position,
    nearest.position,
    maxSquares,
    gridSystem,
    1,
    match.mapDefinition
  );

  if (newPosition.x === botCombatant.position.x && newPosition.z === botCombatant.position.z) {
    return null;
  }

  return { type: 'stride', to: { q: newPosition.x, r: newPosition.z } };
};

export const executeBotInteract = (
  currentMatch: MatchState,
  botCombatant: PF2CombatantState,
  action: { action: 'draw'; itemId: string; targetSlot: 'right_hand' | 'left_hand' },
  activePlayer: { id: string; name: string }
): MatchState => {
  const character = asPF2Character(currentMatch, botCombatant.characterId);
  if (!character) return currentMatch;

  const weapon = character.weapons.find(w => w.id === action.itemId);
  const weaponName = weapon?.name ?? 'weapon';

  const newEquipped = [
    ...botCombatant.equipped,
    { equipmentId: action.itemId, slot: action.targetSlot, ready: true },
  ];

  const updatedCombatants = currentMatch.combatants.map(c => {
    if (c.playerId === activePlayer.id && isPF2Combatant(c)) {
      return {
        ...c,
        equipped: newEquipped,
        actionsRemaining: c.actionsRemaining - 1,
      };
    }
    return c;
  });

  return {
    ...currentMatch,
    combatants: updatedCombatants,
    log: [...currentMatch.log, `${activePlayer.name} draws ${weaponName}.`],
  };
};

export const executeBotStrike = (
  matchId: string,
  currentMatch: MatchState,
  botCombatant: PF2CombatantState,
  targetId: string,
  activePlayer: { id: string; name: string }
): MatchState => {
  const adapter = getServerAdapter('pf2');
  const attackerCharacter = asPF2Character(currentMatch, botCombatant.characterId);
  const target = currentMatch.combatants.find(c => c.playerId === targetId);
  if (!target || !isPF2Combatant(target)) {
    return currentMatch;
  }
  const targetCharacter = asPF2Character(currentMatch, target.characterId);

  if (!attackerCharacter || !targetCharacter) {
    return currentMatch;
  }

  const equippedWeapon = botCombatant.equipped?.find(e => e.ready && (e.slot === 'right_hand' || e.slot === 'left_hand'));
  const weapon = equippedWeapon
    ? attackerCharacter.weapons.find(w => w.id === equippedWeapon.equipmentId) ?? attackerCharacter.weapons[0]
    : attackerCharacter.weapons[0];
  const weaponName = weapon?.name ?? 'Fist';
  const weaponDamage = weapon?.damage ?? '1d4';
  const pf2DamageType: string = weapon?.damageType ?? 'bludgeoning';
  const isAgile = weapon?.traits?.includes('agile') ?? false;

  const isFinesse = weapon?.traits?.includes('finesse') ?? false;
  const strMod = adapter.pf2!.getAbilityModifier(attackerCharacter.abilities.strength);
  const dexMod = adapter.pf2!.getAbilityModifier(attackerCharacter.abilities.dexterity);
  const abilityMod = isFinesse ? Math.max(strMod, dexMod) : strMod;
  const level = attackerCharacter.level;
  const profBonus = adapter.pf2!.getProficiencyBonus('trained', level);
  const mapPenalty = botCombatant.mapPenalty || 0;
  const totalAttackBonus = abilityMod + profBonus + mapPenalty;

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

  const minPenalty = isAgile ? -8 : -10;
  const penaltyStep = isAgile ? -4 : -5;
  const newMapPenalty = Math.max(minPenalty, mapPenalty + penaltyStep);

  const updatedCombatants = currentMatch.combatants.map(c => {
    if (c.playerId === targetId && damageDealt > 0) {
      const newHP = Math.max(0, c.currentHP - damageDealt);
      return {
        ...c,
        currentHP: newHP,
        statusEffects: newHP <= 0
          ? [...c.statusEffects.filter(e => e !== 'unconscious'), 'unconscious']
          : c.statusEffects,
      };
    }
    if (c.playerId === activePlayer.id && isPF2Combatant(c)) {
      return {
        ...c,
        actionsRemaining: c.actionsRemaining - 1,
        mapPenalty: newMapPenalty,
      };
    }
    return c;
  });

  const targetAfterDamage = updatedCombatants.find(c => c.playerId === targetId);
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

  return {
    ...currentMatch,
    combatants: updatedCombatants,
    log: [...currentMatch.log, logEntry],
  };
};

export const executeBotStride = (
  currentMatch: MatchState,
  botCombatant: PF2CombatantState,
  to: { q: number; r: number },
  activePlayer: { id: string; name: string }
): MatchState => {
  if (isBlocked(currentMatch.mapDefinition, to.q, to.r)) {
    return currentMatch;
  }
  const newPosition = { x: to.q, y: botCombatant.position.y, z: to.r };
  const newFacing = calculateFacing(botCombatant.position, newPosition);

  const updatedCombatants = currentMatch.combatants.map(c => {
    if (c.playerId === activePlayer.id && isPF2Combatant(c)) {
      return {
        ...c,
        position: newPosition,
        facing: newFacing,
        actionsRemaining: c.actionsRemaining - 1,
      };
    }
    return c;
  });

  return {
    ...currentMatch,
    combatants: updatedCombatants,
    log: [...currentMatch.log, `${activePlayer.name} strides to (${to.q}, ${to.r}).`],
  };
};

export const executeBotAttack: BotAttackExecutor = async (
  matchId: string,
  currentMatch: MatchState,
  botCombatant: CombatantState,
  target: CombatantState,
  activePlayer: { id: string; name: string }
): Promise<MatchState> => {
  if (!isPF2Combatant(botCombatant) || !isPF2Combatant(target)) {
    return advanceTurn({
      ...currentMatch,
      log: [...currentMatch.log, `${activePlayer.name} waits.`],
    });
  }

  const result = executeBotStrike(matchId, currentMatch, botCombatant, target.playerId, activePlayer);

  const botAfter = result.combatants.find(c => c.playerId === activePlayer.id);
  const actionsLeft = (botAfter && isPF2Combatant(botAfter)) ? botAfter.actionsRemaining : 0;

  if (actionsLeft <= 0) {
    return advanceTurn(result);
  }
  return result;
};
