import type { WebSocket } from "ws";
import type { MatchState, Player, PendingReaction } from "../../../../shared/types";
import type { CombatantState } from "../../../../shared/rulesets";
import { isPF2Combatant } from "../../../../shared/rulesets";
import { isPF2Character } from "../../../../shared/rulesets/characterSheet";
import { getReachableSquares } from "../../../../shared/rulesets/pf2/rules";
import { getServerAdapter } from "../../../../shared/rulesets/serverAdapter";
import { state } from "../../state";
import { updateMatchState } from "../../db";
import {
  sendMessage,
  sendToMatch,
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

type DegreeOfSuccess = 'critical_success' | 'success' | 'failure' | 'critical_failure';

const formatDegree = (degree: DegreeOfSuccess): string => {
  switch (degree) {
    case 'critical_success': return 'Critical Hit!';
    case 'success': return 'Hit';
    case 'failure': return 'Miss';
    case 'critical_failure': return 'Critical Miss!';
  }
};

/**
 * Execute an Attack of Opportunity strike.
 * Returns updated match state with AoO resolved and reactor's reaction consumed.
 */
export const executeAoOStrike = (
  match: MatchState,
  matchId: string,
  reactor: CombatantState,
  trigger: CombatantState,
): MatchState => {
  if (!isPF2Combatant(reactor)) return match;
  if (!isPF2Combatant(trigger)) return match;

  const adapter = getServerAdapter('pf2');
  if (!adapter.pf2) return match;

  const reactorChar = getCharacterById(match, reactor.characterId);
  const triggerChar = getCharacterById(match, trigger.characterId);
  if (!reactorChar || !triggerChar) return match;
  if (!isPF2Character(reactorChar) || !isPF2Character(triggerChar)) return match;

  const equippedWeapon = reactor.equipped?.find(e => e.ready && (e.slot === 'right_hand' || e.slot === 'left_hand'));
  const weapon = equippedWeapon
    ? reactorChar.weapons.find(w => w.id === equippedWeapon.equipmentId) ?? reactorChar.weapons[0]
    : reactorChar.weapons[0];
  const weaponName = weapon?.name ?? 'Fist';
  const weaponDamage = weapon?.damage ?? '1d4';
  const weaponDamageType = weapon?.damageType ?? 'bludgeoning';
  const weaponTraits = weapon?.traits ?? ['agile', 'finesse', 'unarmed'];

  const abilities = reactorChar.abilities;
  const isFinesse = weaponTraits.includes('finesse');
  const strMod = adapter.pf2.getAbilityModifier(abilities.strength);
  const dexMod = adapter.pf2.getAbilityModifier(abilities.dexterity);
  const abilityMod = isFinesse ? Math.max(strMod, dexMod) : strMod;

  const level = reactorChar.level;
  const profBonus = adapter.pf2.getProficiencyBonus('trained', level);

  // AoO does NOT take MAP (it's a reaction, not an action on your turn)
  const conditionAttackMod = getConditionAttackModifier(reactor);
  const totalAttackBonus = abilityMod + profBonus + conditionAttackMod;

  const conditionACMod = getConditionACModifier(trigger, 'melee');
  const shieldBonus = trigger.shieldRaised ? 2 : 0;
  const effectiveAC = triggerChar.derived.armorClass + conditionACMod + shieldBonus;

  const attackRoll = adapter.pf2.rollCheck(totalAttackBonus, effectiveAC);

  let logEntry = `⚔️ ${reactorChar.name} makes an Attack of Opportunity against ${triggerChar.name} with ${weaponName}`;
  const conditionLogSuffix = formatConditionModifiers(conditionAttackMod, conditionACMod);
  if (conditionLogSuffix) {
    logEntry += conditionLogSuffix;
  }
  logEntry += `: [${attackRoll.roll}+${attackRoll.modifier}=${attackRoll.total} vs AC ${attackRoll.dc}] ${formatDegree(attackRoll.degree)}`;

  let damageDealt = 0;
  if (attackRoll.degree === 'critical_success' || attackRoll.degree === 'success') {
    const damageRoll = adapter.pf2.rollDamage(`${weaponDamage}+${strMod}`, weaponDamageType);
    damageDealt = attackRoll.degree === 'critical_success' ? damageRoll.total * 2 : damageRoll.total;
    logEntry += ` for ${damageDealt} ${weaponDamageType} damage`;
    if (attackRoll.degree === 'critical_success') {
      logEntry += ' (doubled)';
    }
    logEntry += ` [${damageRoll.rolls.join('+')}${damageRoll.modifier >= 0 ? '+' : ''}${damageRoll.modifier}]`;
  }

  const updatedCombatants = match.combatants.map(c => {
    if (c.playerId === trigger.playerId && damageDealt > 0) {
      const newHP = Math.max(0, c.currentHP - damageDealt);
      return {
        ...c,
        currentHP: newHP,
        statusEffects: newHP <= 0
          ? [...c.statusEffects.filter(e => e !== 'unconscious'), 'unconscious']
          : c.statusEffects,
      };
    }
    if (c.playerId === reactor.playerId && isPF2Combatant(c)) {
      return { ...c, reactionAvailable: false };
    }
    return c;
  });

  const triggerAfterDamage = updatedCombatants.find(c => c.playerId === trigger.playerId);
  if (triggerAfterDamage && triggerAfterDamage.currentHP <= 0) {
    logEntry += `. ${triggerChar.name} falls unconscious!`;
  }

  if (damageDealt > 0) {
    sendToMatch(matchId, {
      type: "visual_effect",
      matchId,
      effect: {
        type: "damage",
        attackerId: reactor.playerId,
        targetId: trigger.playerId,
        value: damageDealt,
        position: trigger.position,
      },
    });
  } else {
    sendToMatch(matchId, {
      type: "visual_effect",
      matchId,
      effect: {
        type: "miss",
        attackerId: reactor.playerId,
        targetId: trigger.playerId,
        position: trigger.position,
      },
    });
  }

  return {
    ...match,
    combatants: updatedCombatants,
    log: [...match.log, logEntry],
  };
};

export const getAoOReactors = (
  match: MatchState,
  actorCombatant: CombatantState,
): CombatantState[] => {
  const gridSystem = getGridSystemForMatch(match);

  return match.combatants.filter(c => {
    if (c.playerId === actorCombatant.playerId) return false;
    if (c.currentHP <= 0) return false;
    if (!isPF2Combatant(c)) return false;
    if (!c.reactionAvailable) return false;

    const character = getCharacterById(match, c.characterId);
    if (!character || !isPF2Character(character)) return false;
    if (!hasFeat(character, 'Attack of Opportunity')) return false;

    const distance = calculateGridDistance(c.position, actorCombatant.position, gridSystem);
    return distance === 1;
  });
};

export const handlePF2ReactionChoice = async (
  socket: WebSocket,
  matchId: string,
  match: MatchState,
  player: Player,
  payload: { choice: 'aoo' | 'decline' },
): Promise<void> => {
  const pending = match.pendingReaction;
  if (!pending) {
    sendMessage(socket, { type: "error", message: "No pending reaction." });
    return;
  }

  if (pending.reactorId !== player.id) {
    sendMessage(socket, { type: "error", message: "Not your reaction." });
    return;
  }

  const reactor = match.combatants.find(c => c.playerId === pending.reactorId);
  const trigger = match.combatants.find(c => c.playerId === pending.triggerId);

  if (!reactor || !trigger) {
    sendMessage(socket, { type: "error", message: "Combatant not found." });
    return;
  }

  let updated: MatchState;

  if (payload.choice === 'aoo') {
    updated = executeAoOStrike(match, matchId, reactor, trigger);
  } else {
    // Declining AoO does not consume the reaction per PF2 rules
    const reactorChar = getCharacterById(match, reactor.characterId);
    updated = {
      ...match,
      log: [...match.log, `${reactorChar?.name ?? 'Unknown'} declines the Attack of Opportunity.`],
    };
  }

  updated = { ...updated, pendingReaction: undefined };
  updated = await resumeStrideAfterReaction(matchId, updated, pending);

  updated = checkVictory(updated);
  state.matches.set(matchId, updated);
  await updateMatchState(matchId, updated);
  await sendToMatch(matchId, { type: "match_state", state: updated });

  if (updated.status === 'finished') {
    scheduleBotTurn(matchId, updated);
  }
};

export const handleShieldBlockReaction = (
  match: MatchState,
  matchId: string,
  defender: CombatantState,
  incomingDamage: number,
): { match: MatchState; reducedDamage: number } => {
  if (!isPF2Combatant(defender)) {
    return { match, reducedDamage: incomingDamage };
  }

  const defenderChar = getCharacterById(match, defender.characterId);
  if (!defenderChar || !isPF2Character(defenderChar)) {
    return { match, reducedDamage: incomingDamage };
  }

  if (!hasFeat(defenderChar, 'Shield Block')) {
    return { match, reducedDamage: incomingDamage };
  }

  if (!defender.shieldRaised) {
    return { match, reducedDamage: incomingDamage };
  }

  if (!defender.reactionAvailable) {
    return { match, reducedDamage: incomingDamage };
  }

  const shieldHardness = defenderChar.shieldHardness;
  const damageAfterHardness = Math.max(0, incomingDamage - shieldHardness);
  const shieldDamage = Math.max(0, incomingDamage - shieldHardness);
  const currentShieldHP = defender.shieldHP ?? 0;
  const newShieldHP = Math.max(0, currentShieldHP - shieldDamage);
  const shieldBroken = newShieldHP <= 0;

  const updatedCombatants = match.combatants.map(c => {
    if (c.playerId === defender.playerId && isPF2Combatant(c)) {
      return {
        ...c,
        shieldHP: newShieldHP,
        reactionAvailable: false,
      };
    }
    return c;
  });

  let logEntry = `🛡️ ${defenderChar.name} uses Shield Block: damage reduced by ${shieldHardness} (hardness)`;
  if (shieldDamage > 0) {
    logEntry += `, shield takes ${shieldDamage} damage`;
    if (shieldBroken) {
      logEntry += ` and breaks!`;
    }
  }

  return {
    match: {
      ...match,
      combatants: updatedCombatants,
      log: [...match.log, logEntry],
    },
    reducedDamage: damageAfterHardness,
  };
};

export const handleReactiveShieldReaction = (
  match: MatchState,
  matchId: string,
  defender: CombatantState,
): MatchState => {
  if (!isPF2Combatant(defender)) {
    return match;
  }

  const defenderChar = getCharacterById(match, defender.characterId);
  if (!defenderChar || !isPF2Character(defenderChar)) {
    return match;
  }

  if (!hasFeat(defenderChar, 'Reactive Shield')) {
    return match;
  }

  if (defender.shieldRaised) {
    return match;
  }

  if (!defender.reactionAvailable) {
    return match;
  }

  const updatedCombatants = match.combatants.map(c => {
    if (c.playerId === defender.playerId && isPF2Combatant(c)) {
      return {
        ...c,
        shieldRaised: true,
        reactionAvailable: false,
      };
    }
    return c;
  });

  const logEntry = `🛡️ ${defenderChar.name} uses Reactive Shield: shield raised as reaction`;

  return {
    ...match,
    combatants: updatedCombatants,
    log: [...match.log, logEntry],
  };
};

export const resumeStrideAfterReaction = async (
  matchId: string,
  match: MatchState,
  pending: PendingReaction,
): Promise<MatchState> => {
  const originalPayload = pending.originalPayload;
  if (originalPayload.type !== 'pf2_stride') return match;

  const triggerPlayer = match.players.find(p => p.id === pending.triggerId);
  if (!triggerPlayer) return match;

  const triggerCombatant = match.combatants.find(c => c.playerId === pending.triggerId);
  if (!triggerCombatant) return match;
  if (!isPF2Combatant(triggerCombatant)) return match;

  if (triggerCombatant.currentHP <= 0) {
    return {
      ...match,
      log: [...match.log, `${triggerPlayer.name}'s stride is interrupted — they fall unconscious!`],
      reachableHexes: undefined,
    };
  }

  const to = originalPayload.to;
  const startPos = { q: triggerCombatant.position.x, r: triggerCombatant.position.z };
  const occupiedSquares = match.combatants
    .filter(c => c.playerId !== pending.triggerId)
    .map(c => ({ q: c.position.x, r: c.position.z }));
  const character = match.characters.find(ch => ch.id === triggerCombatant.characterId);
  const speed = (character && isPF2Character(character)) ? character.derived.speed : 25;
  const reachable = getReachableSquares(startPos, speed, occupiedSquares, match.mapDefinition);
  const destResult = reachable.get(`${to.q},${to.r}`);
  const movementPath = destResult
    ? destResult.path.map((p: { q: number; r: number }) => ({ x: p.q, y: 0, z: p.r }))
    : undefined;

  const updatedCombatants = match.combatants.map(c =>
    c.playerId === pending.triggerId
      ? {
          ...c,
          position: { x: to.q, y: c.position.y, z: to.r },
          movementPath,
        }
      : c
  );

  return {
    ...match,
    combatants: updatedCombatants,
    log: [...match.log, `${triggerPlayer.name} completes stride to (${to.q}, ${to.r}).`],
    reachableHexes: undefined,
  };
};
