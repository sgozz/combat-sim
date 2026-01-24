import type { WebSocket } from "ws";
import type {
  MatchState,
  Player,
} from "../../../shared/types";
import type {
  CombatActionPayload,
  PendingDefense,
  DefenseType,
  DamageType,
  Reach,
} from "../../../shared/rulesets/gurps/types";
import { isPf2Match, getServerAdapter } from "../../../shared/rulesets/serverAdapter";
import { advanceTurn } from "../rulesetHelpers";
import { state } from "../state";
import { updateMatchState } from "../db";
import { 
  sendMessage, 
  sendToMatch, 
  getCombatantByPlayerId, 
  getCharacterById,
  calculateHexDistance,
  calculateFacing,
  findRetreatHex,
  checkVictory,
} from "../helpers";
import { scheduleBotTurn, chooseBotDefense } from "../bot";
import { clearDefenseTimeout } from "../timers";
import { formatRoll, applyDamageToTarget } from "./damage";
import { handlePF2AttackAction } from "./pf2-attack";

const BOT_DEFENSE_DELAY_MS = 800;

const scheduleBotDefense = (matchId: string, match: MatchState, defenderId: string) => {
  setTimeout(async () => {
    const currentMatch = state.matches.get(matchId);
    if (!currentMatch?.pendingDefense) return;
    
    const defenderCombatant = currentMatch.combatants.find(c => c.playerId === defenderId);
    const defenderCharacter = currentMatch.characters.find(c => c.id === defenderCombatant?.characterId);
    
    if (!defenderCombatant || !defenderCharacter) {
      await resolveDefenseChoice(matchId, currentMatch, {
        type: 'defend',
        defenseType: 'dodge',
        retreat: false,
        dodgeAndDrop: false,
      });
      return;
    }
    
    const choice = chooseBotDefense(defenderCharacter, defenderCombatant);
    
    await resolveDefenseChoice(matchId, currentMatch, {
      type: 'defend',
      ...choice,
    });
  }, BOT_DEFENSE_DELAY_MS);
};

export const resolveDefenseChoice = async (
  matchId: string,
  match: MatchState,
  choice: { type: 'defend'; defenseType: DefenseType; retreat: boolean; dodgeAndDrop: boolean }
): Promise<void> => {
  const pending = match.pendingDefense;
  if (!pending) return;
  
  const adapter = getServerAdapter(match.rulesetId ?? 'gurps');
  
  clearDefenseTimeout(matchId);
  
  const defenderCombatant = match.combatants.find(c => c.playerId === pending.defenderId);
  const attackerCombatant = match.combatants.find(c => c.playerId === pending.attackerId);
  const defenderCharacter = match.characters.find(c => c.id === defenderCombatant?.characterId);
  const attackerCharacter = match.characters.find(c => c.id === attackerCombatant?.characterId);
  
  if (!defenderCombatant || !attackerCombatant || !defenderCharacter || !attackerCharacter) return;

  if (choice.defenseType === 'none') {
    const dmg = adapter.rollDamage!(pending.damage);
    let baseDamage = dmg.total;
    if (attackerCombatant.maneuver === 'all_out_attack' && attackerCombatant.aoaVariant === 'strong') {
      baseDamage += 2;
    }
    
    const result = applyDamageToTarget(
      match, pending.defenderId, baseDamage, pending.damage,
      pending.damageType, pending.hitLocation, dmg.rolls, dmg.modifier
    );
    
    let logEntry = `${defenderCharacter.name} does not defend: Hit for ${result.finalDamage} damage ${result.logEntry}`;
    if (result.fellUnconscious) {
      logEntry += ` ${defenderCharacter.name} falls unconscious!`;
    }
    if (result.majorWoundStunned) {
      logEntry += ` Major wound! ${defenderCharacter.name} is stunned!`;
    }
    
    sendToMatch(matchId, { 
      type: "visual_effect", 
      matchId,
      effect: { type: "damage", attackerId: pending.attackerId, targetId: pending.defenderId, value: result.finalDamage, position: defenderCombatant.position } 
    });

    const remainingAttacks = attackerCombatant.attacksRemaining - 1;
    
    if (remainingAttacks > 0) {
      const updatedCombatants = result.updatedCombatants.map(c => 
        c.playerId === pending.attackerId ? { ...c, attacksRemaining: remainingAttacks } : c
      );
      const updated: MatchState = {
        ...match,
        combatants: updatedCombatants,
        pendingDefense: undefined,
        log: [...match.log, logEntry, `${attackerCharacter.name} has ${remainingAttacks} attack(s) remaining.`],
      };
      const checkedUpdate = checkVictory(updated);
      state.matches.set(matchId, checkedUpdate);
      await updateMatchState(matchId, checkedUpdate);
      sendToMatch(matchId, { type: "match_state", state: checkedUpdate });
    } else {
      let updated = advanceTurn({
        ...match,
        combatants: result.updatedCombatants,
        pendingDefense: undefined,
        log: [...match.log, logEntry],
      });
      updated = checkVictory(updated);
      state.matches.set(matchId, updated);
      await updateMatchState(matchId, updated);
      sendToMatch(matchId, { type: "match_state", state: updated });
      scheduleBotTurn(matchId, updated);
    }
    return;
  }

  const defenderEncumbrance = adapter.calculateEncumbrance!(
    defenderCharacter.attributes.strength,
    defenderCharacter.equipment
  );
  const effectiveDefenderDodge = defenderCharacter.derived.dodge + defenderEncumbrance.dodgePenalty;
  const defenseOptions = adapter.getDefenseOptions!(defenderCharacter, effectiveDefenderDodge);
  const distance = calculateHexDistance(attackerCombatant.position, defenderCombatant.position);
  const inCloseCombat = distance === 0;
  const defenderWeapon = defenderCharacter.equipment.find(e => e.type === 'melee');
  const defenderShield = defenderCharacter.equipment.find(e => e.type === 'shield');
  const ccDefMods = adapter.getCloseCombatDefenseModifiers!(
    defenderWeapon?.reach,
    defenderShield?.shieldSize,
    inCloseCombat
  );
  
  let baseDefense = 0;
  let defenseLabel = '';
  
  let parryWeaponName: string | null = null;
  let sameWeaponParry = false;
  
  switch (choice.defenseType) {
    case 'dodge':
      baseDefense = defenseOptions.dodge + ccDefMods.dodge;
      defenseLabel = 'Dodge';
      break;
    case 'parry':
      if (!defenseOptions.parry || !ccDefMods.canParry) {
        baseDefense = 3;
        defenseLabel = 'Parry (unavailable)';
      } else {
        baseDefense = defenseOptions.parry.value + ccDefMods.parry;
        defenseLabel = `Parry (${defenseOptions.parry.weapon})`;
        parryWeaponName = defenseOptions.parry.weapon;
        sameWeaponParry = defenderCombatant.parryWeaponsUsedThisTurn.includes(parryWeaponName);
      }
      break;
    case 'block':
      if (!defenseOptions.block || !ccDefMods.canBlock) {
        baseDefense = 3;
        defenseLabel = 'Block (unavailable)';
      } else {
        baseDefense = defenseOptions.block.value + ccDefMods.block;
        defenseLabel = `Block (${defenseOptions.block.shield})`;
      }
      break;
  }
  
  const attackerPos = attackerCombatant.position;
  const defenderPos = defenderCombatant.position;
  const attackDirection = calculateFacing(defenderPos, attackerPos);
  const relativeDir = (attackDirection - defenderCombatant.facing + 6) % 6;
  
  let defenseMod = 0;
  if (relativeDir === 2 || relativeDir === 4) defenseMod = -2;
  if (defenderCombatant.statusEffects.includes('defending')) defenseMod += 1;
  
  const aodVariant = defenderCombatant.aodVariant;
  if (defenderCombatant.maneuver === 'all_out_defense' && aodVariant) {
    if ((aodVariant === 'increased_dodge' && choice.defenseType === 'dodge') ||
        (aodVariant === 'increased_parry' && choice.defenseType === 'parry') ||
        (aodVariant === 'increased_block' && choice.defenseType === 'block')) {
      defenseMod += 2;
    }
  }
  
  const isRanged = attackerCharacter.equipment[0]?.type === 'ranged';
  const defenderPosture = adapter.getPostureModifiers!(defenderCombatant.posture);
  defenseMod += isRanged ? defenderPosture.defenseVsRanged : defenderPosture.defenseVsMelee;
  
  const canRetreat = choice.retreat && !defenderCombatant.retreatedThisTurn;
  
  const finalDefenseValue = adapter.calculateDefenseValue!(baseDefense, {
    retreat: canRetreat,
    dodgeAndDrop: choice.dodgeAndDrop && choice.defenseType === 'dodge',
    inCloseCombat,
    defensesThisTurn: defenderCombatant.defensesThisTurn,
    deceptivePenalty: pending.deceptivePenalty,
    postureModifier: defenseMod,
    defenseType: choice.defenseType,
    sameWeaponParry,
    lostBalance: defenderCombatant.statusEffects.includes('lost_balance'),
  });
  
  const defenseRoll = adapter.resolveDefenseRoll!(finalDefenseValue);
  
  if (defenseRoll.defended) {
    let retreatHex: { x: number; y: number; z: number } | null = null;
    if (canRetreat) {
      retreatHex = findRetreatHex(defenderCombatant.position, attackerCombatant.position, match.combatants);
    }
    
    const retreatStr = canRetreat && retreatHex ? ' (retreat)' : '';
    const dropStr = choice.dodgeAndDrop ? ' (drop)' : '';
    const logEntry = `${defenderCharacter.name} defends with ${defenseLabel}${retreatStr}${dropStr}: ${formatRoll(defenseRoll.roll, defenseLabel)} Success!`;
    
    sendToMatch(matchId, { 
      type: "visual_effect", 
      matchId,
      effect: { type: "defend", attackerId: pending.attackerId, targetId: pending.defenderId, position: defenderCombatant.position } 
    });
    
    let updatedCombatants = match.combatants.map(c => {
      if (c.playerId !== pending.defenderId) return c;
      const newParryWeapons = parryWeaponName && !c.parryWeaponsUsedThisTurn.includes(parryWeaponName)
        ? [...c.parryWeaponsUsedThisTurn, parryWeaponName]
        : c.parryWeaponsUsedThisTurn;
      return { 
        ...c, 
        retreatedThisTurn: (canRetreat && retreatHex !== null) || c.retreatedThisTurn, 
        defensesThisTurn: c.defensesThisTurn + 1,
        parryWeaponsUsedThisTurn: newParryWeapons,
        posture: choice.dodgeAndDrop ? 'prone' as const : c.posture,
        position: retreatHex ?? c.position,
      };
    });
    
    const isMultiAttack = attackerCombatant.attacksRemaining > 1;
    const remainingAttacks = isMultiAttack ? attackerCombatant.attacksRemaining - 1 : 0;
    
    if (remainingAttacks > 0) {
      updatedCombatants = updatedCombatants.map(c => 
        c.playerId === pending.attackerId ? { ...c, attacksRemaining: remainingAttacks } : c
      );
      const updated: MatchState = {
        ...match,
        combatants: updatedCombatants,
        pendingDefense: undefined,
        log: [...match.log, logEntry, `${attackerCharacter.name} has ${remainingAttacks} attack(s) remaining.`],
      };
      state.matches.set(matchId, updated);
      await updateMatchState(matchId, updated);
      sendToMatch(matchId, { type: "match_state", state: updated });
    } else {
      let updated = advanceTurn({ ...match, combatants: updatedCombatants, pendingDefense: undefined, log: [...match.log, logEntry] });
      updated = checkVictory(updated);
      state.matches.set(matchId, updated);
      await updateMatchState(matchId, updated);
      sendToMatch(matchId, { type: "match_state", state: updated });
      scheduleBotTurn(matchId, updated);
    }
  } else {
    const dmg = adapter.rollDamage!(pending.damage);
    let baseDamage = dmg.total;
    if (attackerCombatant.maneuver === 'all_out_attack' && attackerCombatant.aoaVariant === 'strong') {
      baseDamage += 2;
    }
    
    const result = applyDamageToTarget(
      match, pending.defenderId, baseDamage, pending.damage,
      pending.damageType, pending.hitLocation, dmg.rolls, dmg.modifier
    );
    
    let logEntry = `${defenderCharacter.name} fails ${defenseLabel}: ${formatRoll(defenseRoll.roll, defenseLabel)} Failed. Hit for ${result.finalDamage} damage ${result.logEntry}`;
    if (result.fellUnconscious) {
      logEntry += ` ${defenderCharacter.name} falls unconscious!`;
    }
    if (result.majorWoundStunned) {
      logEntry += ` Major wound! ${defenderCharacter.name} is stunned!`;
    }
    
    sendToMatch(matchId, { 
      type: "visual_effect", 
      matchId,
      effect: { type: "damage", attackerId: pending.attackerId, targetId: pending.defenderId, value: result.finalDamage, position: defenderCombatant.position } 
    });

    let updatedCombatants = result.updatedCombatants.map(c => {
      if (c.playerId !== pending.defenderId) return c;
      const newParryWeapons = parryWeaponName && !c.parryWeaponsUsedThisTurn.includes(parryWeaponName)
        ? [...c.parryWeaponsUsedThisTurn, parryWeaponName]
        : c.parryWeaponsUsedThisTurn;
      return { 
        ...c, 
        defensesThisTurn: c.defensesThisTurn + 1,
        parryWeaponsUsedThisTurn: newParryWeapons,
        posture: choice.dodgeAndDrop ? 'prone' as const : c.posture,
      };
    });

    const remainingAttacks = attackerCombatant.attacksRemaining - 1;
    
    if (remainingAttacks > 0) {
      updatedCombatants = updatedCombatants.map(c => 
        c.playerId === pending.attackerId ? { ...c, attacksRemaining: remainingAttacks } : c
      );
      const updated: MatchState = {
        ...match,
        combatants: updatedCombatants,
        pendingDefense: undefined,
        log: [...match.log, logEntry, `${attackerCharacter.name} has ${remainingAttacks} attack(s) remaining.`],
      };
      const checkedUpdate = checkVictory(updated);
      state.matches.set(matchId, checkedUpdate);
      await updateMatchState(matchId, checkedUpdate);
      sendToMatch(matchId, { type: "match_state", state: checkedUpdate });
    } else {
      let updated = advanceTurn({
        ...match,
        combatants: updatedCombatants,
        pendingDefense: undefined,
        log: [...match.log, logEntry],
      });
      updated = checkVictory(updated);
      state.matches.set(matchId, updated);
      await updateMatchState(matchId, updated);
      sendToMatch(matchId, { type: "match_state", state: updated });
      scheduleBotTurn(matchId, updated);
    }
  }
};

export const handleAttackAction = async (
  socket: WebSocket,
  matchId: string,
  match: MatchState,
  player: Player,
  actorCombatant: ReturnType<typeof getCombatantByPlayerId>,
  payload: CombatActionPayload & { type: "attack" }
): Promise<void> => {
  if (!actorCombatant) return;
  
  if (isPf2Match(match)) {
    return handlePF2AttackAction(socket, matchId, match, player, actorCombatant, payload);
  }
  
  const adapter = getServerAdapter(match.rulesetId ?? 'gurps');
  
  if (actorCombatant.inCloseCombatWith && actorCombatant.inCloseCombatWith !== payload.targetId) {
    sendMessage(socket, { type: "error", message: "In close combat - can only attack your close combat opponent." });
    return;
  }
  
  const targetCombatant = match.combatants.find(
    (combatant) => combatant.playerId === payload.targetId
  );
  if (!targetCombatant) {
    sendMessage(socket, { type: "error", message: "Target not found." });
    return;
  }
  const distance = calculateHexDistance(actorCombatant.position, targetCombatant.position);
  const attackerCharacter = getCharacterById(match, actorCombatant.characterId);
  const targetCharacter = getCharacterById(match, targetCombatant.characterId);
  if (!attackerCharacter || !targetCharacter) {
    sendMessage(socket, { type: "error", message: "Character not found." });
    return;
  }
  
  const readyWeapon = actorCombatant.equipped.find(e => e.ready && (e.slot === 'right_hand' || e.slot === 'left_hand'));
  const weapon = readyWeapon 
    ? attackerCharacter.equipment.find(eq => eq.id === readyWeapon.equipmentId)
    : attackerCharacter.equipment[0];
  
  if (!weapon) {
    sendMessage(socket, { type: "error", message: "No weapon available." });
    return;
  }
  
  if (readyWeapon === undefined && actorCombatant.equipped.length > 0) {
    sendMessage(socket, { type: "error", message: "No ready weapon - use Ready maneuver to draw a weapon first." });
    return;
  }
  
  const isRanged = weapon.type === 'ranged';
  const weaponReach: Reach = weapon.reach ?? '1';
  
  if (!isRanged && !adapter.canAttackAtDistance!(weaponReach, distance)) {
    const { max } = adapter.parseReach!(weaponReach);
    sendMessage(socket, { type: "error", message: `Target out of melee range (reach ${max}).` });
    return;
  }
  
  const closeCombatMods = adapter.getCloseCombatAttackModifiers!(weapon ?? { id: '', name: 'Fist', type: 'melee', reach: 'C' }, distance);
  if (!closeCombatMods.canAttack) {
    sendMessage(socket, { type: "error", message: closeCombatMods.reason });
    return;
  }
  
  const attackerManeuver = actorCombatant.maneuver;
  const rapidStrike = payload.rapidStrike ?? false;
  if (rapidStrike && attackerManeuver !== 'attack') {
    sendMessage(socket, { type: "error", message: "Rapid Strike only works with Attack maneuver." });
    return;
  }
  
  const deceptiveLevel = payload.deceptiveLevel ?? 0;
  const hitLocation = payload.hitLocation ?? 'torso';
  const baseSkill = attackerCharacter.skills[0]?.level ?? attackerCharacter.attributes.dexterity;
  
  const skill = adapter.combat?.calculateEffectiveSkill?.({
    baseSkill,
    attackerCombatant: actorCombatant,
    weapon,
    distance,
    targetId: payload.targetId,
    isRanged,
    deceptiveLevel,
    rapidStrike,
    hitLocation,
  }) ?? baseSkill;
  
  const targetFacing = targetCombatant.facing;
  const attackDirection = calculateFacing(targetCombatant.position, actorCombatant.position);
  const relativeDir = (attackDirection - targetFacing + 6) % 6;

  let canDefend = true;
  let defenseDescription = "normal";

  if (relativeDir === 3) {
    canDefend = false;
    defenseDescription = "backstab (no defense)";
  } else if (relativeDir === 2 || relativeDir === 4) {
    defenseDescription = "flank (-2)";
  }

  const targetManeuver = targetCombatant.maneuver;
  
  if (targetManeuver === 'all_out_defense' && targetCombatant.aodVariant) {
    const variantLabel = targetCombatant.aodVariant.replace('increased_', '+2 ').replace('_', ' ');
    defenseDescription += defenseDescription === "normal" ? `AoD (${variantLabel})` : ` + AoD (${variantLabel})`;
  }
  
  if (targetManeuver === 'all_out_attack') {
    canDefend = false;
    defenseDescription = "target in AoA (no defense)";
  }
  
  if (targetCombatant.statusEffects.includes('defending')) {
    defenseDescription += defenseDescription === "normal" ? "defensive (+1)" : " + defensive (+1)";
  }

  const attackRoll = adapter.resolveAttackRoll!(skill);
  const hitLocLabel = hitLocation === 'torso' ? '' : ` [${hitLocation.replace('_', ' ')}]`;
  let logEntry = `${attackerCharacter.name} attacks ${targetCharacter.name}${hitLocLabel} (${defenseDescription})`;

  if (!attackRoll.hit) {
    let critMissEffect = '';
    const updatedAttackerEffects = [...actorCombatant.statusEffects];
    
    if (attackRoll.criticalMiss) {
      const critMiss = adapter.rollCriticalMissTable!();
      const critMissDesc = adapter.getCriticalMissDescription!(critMiss.effect);
      if (critMissDesc) {
        critMissEffect = ` Critical miss (${critMiss.roll})! ${critMissDesc}`;
      }
      if (critMiss.effect.type === 'lost_balance' && !updatedAttackerEffects.includes('lost_balance')) {
        updatedAttackerEffects.push('lost_balance');
      }
    }
    
    logEntry += `: Miss.${critMissEffect} ${formatRoll(attackRoll.roll, 'Skill')}`;
    sendToMatch(matchId, { 
      type: "visual_effect", 
      matchId,
      effect: { type: "miss", attackerId: player.id, targetId: targetCombatant.playerId, position: targetCombatant.position } 
    });
    
    const isDoubleAttack = attackerManeuver === 'all_out_attack' && actorCombatant.aoaVariant === 'double';
    const isMultiAttack = isDoubleAttack || rapidStrike;
    const effectiveAttacksRemaining = rapidStrike && actorCombatant.attacksRemaining === 1 ? 2 : actorCombatant.attacksRemaining;
    const remainingAttacks = isMultiAttack ? effectiveAttacksRemaining - 1 : 0;
    
    if (remainingAttacks > 0) {
      const updatedCombatants = match.combatants.map(c => 
        c.playerId === player.id ? { ...c, attacksRemaining: remainingAttacks, statusEffects: updatedAttackerEffects } : c
      );
      const updated: MatchState = {
        ...match,
        combatants: updatedCombatants,
        log: [...match.log, logEntry, `${attackerCharacter.name} has ${remainingAttacks} attack(s) remaining (Rapid Strike).`],
      };
      state.matches.set(matchId, updated);
      await updateMatchState(matchId, updated);
      sendToMatch(matchId, { type: "match_state", state: updated });
    } else {
      const combatantsWithEffects = match.combatants.map(c =>
        c.playerId === player.id ? { ...c, statusEffects: updatedAttackerEffects } : c
      );
      let updated = advanceTurn({ ...match, combatants: combatantsWithEffects, log: [...match.log, logEntry] });
      updated = checkVictory(updated);
      state.matches.set(matchId, updated);
      await updateMatchState(matchId, updated);
      sendToMatch(matchId, { type: "match_state", state: updated });
      scheduleBotTurn(matchId, updated);
    }
    return;
  }

  const damageFormula = weapon?.damage ?? "1d";
  const damageType: DamageType = weapon?.damageType ?? 'crushing';

  if (attackRoll.critical || !canDefend) {
    const dmg = adapter.rollDamage!(damageFormula);
    let baseDamage = dmg.total;
    if (attackerManeuver === 'all_out_attack' && actorCombatant.aoaVariant === 'strong') {
      baseDamage += 2;
    }
    
    let critHitStr = '';
    let finalBaseDamage = baseDamage;
    if (attackRoll.critical) {
      const critHit = adapter.rollCriticalHitTable!();
      const critResult = adapter.applyCriticalHitDamage!(baseDamage, critHit.effect, damageFormula);
      finalBaseDamage = critResult.damage;
      critHitStr = critResult.description ? `Critical hit (${critHit.roll})! ${critResult.description} ` : `Critical hit (${critHit.roll})! `;
    }
    
    const result = applyDamageToTarget(
      match, targetCombatant.playerId, finalBaseDamage, damageFormula, 
      damageType, hitLocation, dmg.rolls, dmg.modifier
    );
    
    const noDefStr = !canDefend && !attackRoll.critical ? `${defenseDescription}. ` : '';
    logEntry += `: ${critHitStr}${noDefStr}Hit for ${result.finalDamage} damage ${result.logEntry}. ${formatRoll(attackRoll.roll, 'Attack')}`;
    if (result.majorWoundStunned) {
      logEntry += ` Major wound! ${targetCharacter.name} is stunned!`;
    }
    if (result.fellUnconscious) {
      logEntry += ` ${targetCharacter.name} falls unconscious!`;
    }
    
    sendToMatch(matchId, { 
      type: "visual_effect", 
      matchId,
      effect: { type: "damage", attackerId: player.id, targetId: targetCombatant.playerId, value: result.finalDamage, position: targetCombatant.position } 
    });

    const isDoubleAttack = attackerManeuver === 'all_out_attack' && actorCombatant.aoaVariant === 'double';
    const isMultiAttack = isDoubleAttack || rapidStrike;
    const effectiveAttacksRemaining = rapidStrike && actorCombatant.attacksRemaining === 1 ? 2 : actorCombatant.attacksRemaining;
    const remainingAttacks = isMultiAttack ? effectiveAttacksRemaining - 1 : 0;
    
    if (remainingAttacks > 0) {
      const updatedCombatants = result.updatedCombatants.map(c => 
        c.playerId === player.id ? { ...c, attacksRemaining: remainingAttacks } : c
      );
      const updated: MatchState = {
        ...match,
        combatants: updatedCombatants,
        log: [...match.log, logEntry, `${attackerCharacter.name} has ${remainingAttacks} attack(s) remaining.`],
      };
      const checkedUpdate = checkVictory(updated);
      state.matches.set(matchId, checkedUpdate);
      await updateMatchState(matchId, checkedUpdate);
      sendToMatch(matchId, { type: "match_state", state: checkedUpdate });
      if (checkedUpdate.status === 'finished') {
        scheduleBotTurn(matchId, checkedUpdate);
      }
    } else {
      let updated = advanceTurn({
        ...match,
        combatants: result.updatedCombatants,
        log: [...match.log, logEntry],
      });
      updated = checkVictory(updated);
      state.matches.set(matchId, updated);
      await updateMatchState(matchId, updated);
      sendToMatch(matchId, { type: "match_state", state: updated });
      scheduleBotTurn(matchId, updated);
    }
    return;
  }

  const targetPlayer = match.players.find(p => p.id === targetCombatant.playerId);
  const isDefenderBot = targetPlayer?.isBot ?? false;

  if (isDefenderBot) {
    const botDefense = adapter.combat?.selectBotDefense?.({
      targetCharacter,
      targetCombatant,
      attackerPosition: actorCombatant.position,
      allCombatants: match.combatants,
      distance,
      relativeDir,
      isRanged,
      findRetreatHex,
    });
    
    if (!botDefense) {
      const dmg = adapter.rollDamage!(damageFormula);
      let baseDamage = dmg.total;
      if (attackerManeuver === 'all_out_attack' && actorCombatant.aoaVariant === 'strong') {
        baseDamage += 2;
      }
      
      const result = applyDamageToTarget(
        match, targetCombatant.playerId, baseDamage, damageFormula,
        damageType, hitLocation, dmg.rolls, dmg.modifier
      );
      logEntry += `: Hit! ${formatRoll(attackRoll.roll, 'Attack')} -> ${result.logEntry}`;
      
      let updated = advanceTurn({
        ...match,
        combatants: result.updatedCombatants,
        log: [...match.log, logEntry],
      });
      updated = checkVictory(updated);
      state.matches.set(matchId, updated);
      await updateMatchState(matchId, updated);
      sendToMatch(matchId, { type: "match_state", state: updated });
      scheduleBotTurn(matchId, updated);
      return;
    }
    
    const { defenseType: defenseUsed, defenseLabel, finalDefenseValue, canRetreat, retreatHex, parryWeaponName: botParryWeaponName } = botDefense;
    
const defenseRoll = adapter.resolveDefenseRoll!(finalDefenseValue);
    
    if (defenseRoll.defended) {
      const retreatStr = canRetreat ? ' (with retreat)' : '';
      logEntry += `: ${defenseLabel}${retreatStr}! ${formatRoll(attackRoll.roll, 'Attack')} -> ${formatRoll(defenseRoll.roll, defenseLabel)}`;
      sendToMatch(matchId, { 
        type: "visual_effect", 
        matchId,
        effect: { type: "defend", attackerId: player.id, targetId: targetCombatant.playerId, position: targetCombatant.position } 
      });
      
      let updatedCombatants = match.combatants.map(c => {
        if (c.playerId !== targetCombatant.playerId) return c;
        const newParryWeapons = botParryWeaponName && !c.parryWeaponsUsedThisTurn.includes(botParryWeaponName)
          ? [...c.parryWeaponsUsedThisTurn, botParryWeaponName]
          : c.parryWeaponsUsedThisTurn;
        return { 
          ...c, 
          retreatedThisTurn: canRetreat || c.retreatedThisTurn, 
          defensesThisTurn: c.defensesThisTurn + 1, 
          parryWeaponsUsedThisTurn: newParryWeapons,
          position: retreatHex ?? c.position 
        };
      });
      
      const isMultiAttack = actorCombatant.attacksRemaining > 1;
      const remainingAttacks = isMultiAttack ? actorCombatant.attacksRemaining - 1 : 0;
      
      if (remainingAttacks > 0) {
        updatedCombatants = updatedCombatants.map(c => 
          c.playerId === player.id ? { ...c, attacksRemaining: remainingAttacks } : c
        );
        const updated: MatchState = {
          ...match,
          combatants: updatedCombatants,
          log: [...match.log, logEntry, `${attackerCharacter.name} has ${remainingAttacks} attack(s) remaining.`],
        };
        state.matches.set(matchId, updated);
        await updateMatchState(matchId, updated);
        sendToMatch(matchId, { type: "match_state", state: updated });
      } else {
        let updated = advanceTurn({ ...match, combatants: updatedCombatants, log: [...match.log, logEntry] });
        updated = checkVictory(updated);
        state.matches.set(matchId, updated);
        await updateMatchState(matchId, updated);
        sendToMatch(matchId, { type: "match_state", state: updated });
        scheduleBotTurn(matchId, updated);
      }
    } else {
      const dmg = adapter.rollDamage!(damageFormula);
      let baseDamage = dmg.total;
      if (attackerManeuver === 'all_out_attack' && actorCombatant.aoaVariant === 'strong') {
        baseDamage += 2;
      }
      
      const result = applyDamageToTarget(
        match, targetCombatant.playerId, baseDamage, damageFormula,
        damageType, hitLocation, dmg.rolls, dmg.modifier
      );
      
      logEntry += `: Hit for ${result.finalDamage} damage ${result.logEntry}. ${formatRoll(attackRoll.roll, 'Attack')} -> ${formatRoll(defenseRoll.roll, defenseLabel)} Failed`;
      if (result.fellUnconscious) {
        logEntry += ` ${targetCharacter.name} falls unconscious!`;
      }
      if (result.majorWoundStunned) {
        logEntry += ` Major wound! ${targetCharacter.name} is stunned!`;
      }
      
      sendToMatch(matchId, { 
        type: "visual_effect", 
        matchId,
        effect: { type: "damage", attackerId: player.id, targetId: targetCombatant.playerId, value: result.finalDamage, position: targetCombatant.position } 
      });

      const isMultiAttack = actorCombatant.attacksRemaining > 1;
      const remainingAttacks = isMultiAttack ? actorCombatant.attacksRemaining - 1 : 0;
      
      if (remainingAttacks > 0) {
        const updatedCombatants = result.updatedCombatants.map(c => 
          c.playerId === player.id ? { ...c, attacksRemaining: remainingAttacks } : c
        );
        const updated: MatchState = {
          ...match,
          combatants: updatedCombatants,
          log: [...match.log, logEntry, `${attackerCharacter.name} has ${remainingAttacks} attack(s) remaining.`],
        };
        const checkedUpdate = checkVictory(updated);
        state.matches.set(matchId, checkedUpdate);
        await updateMatchState(matchId, checkedUpdate);
        sendToMatch(matchId, { type: "match_state", state: checkedUpdate });
        if (checkedUpdate.status === 'finished') {
          scheduleBotTurn(matchId, checkedUpdate);
        }
      } else {
        let updated = advanceTurn({
          ...match,
          combatants: result.updatedCombatants,
          log: [...match.log, logEntry],
        });
        updated = checkVictory(updated);
        state.matches.set(matchId, updated);
        await updateMatchState(matchId, updated);
        sendToMatch(matchId, { type: "match_state", state: updated });
        scheduleBotTurn(matchId, updated);
      }
    }
    return;
  }

  const pendingDefense: PendingDefense = {
    attackerId: player.id,
    defenderId: targetCombatant.playerId,
    attackRoll: attackRoll.roll.roll,
    attackMargin: attackRoll.roll.margin,
    hitLocation,
    weapon: weapon?.name ?? 'Unarmed',
    damage: damageFormula,
    damageType,
    deceptivePenalty: deceptiveLevel,
    timestamp: Date.now(),
  };

  logEntry += `: ${formatRoll(attackRoll.roll, 'Attack')} - awaiting defense...`;

  const updated: MatchState = {
    ...match,
    pendingDefense,
    log: [...match.log, logEntry],
  };
  
  state.matches.set(matchId, updated);
  await updateMatchState(matchId, updated);
  sendToMatch(matchId, { type: "match_state", state: updated });
  
  const defenderPlayer = match.players.find(p => p.id === pendingDefense.defenderId);
  if (defenderPlayer?.isBot) {
    scheduleBotDefense(matchId, updated, pendingDefense.defenderId);
  }
};
