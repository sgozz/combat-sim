import type { WebSocket } from "ws";
import type { MatchState, Player } from "../../../../shared/types";
import { isPF2Character } from "../../../../shared/types";
import type { PF2CharacterSheet } from "../../../../shared/rulesets/pf2/characterSheet";
import { isPF2Combatant } from "../../../../shared/rulesets";
import { 
  canCastSpell, 
  calculateSpellAttack, 
  calculateSpellDC,
  rollCheck,
  rollDamage,
  applyHealing,
  getAbilityModifier,
} from "../../../../shared/rulesets/pf2/rules";
import { getSpell, getHeightenedDamage } from "../../../../shared/rulesets/pf2/spellData";
import type { PF2CombatantState } from "../../../../shared/rulesets/pf2/types";
import { state } from "../../state";
import { updateMatchState } from "../../db";
import {
  sendMessage,
  sendToMatch,
  getCombatantByPlayerId,
  getCharacterById,
} from "../../helpers";

function hexDistance(q1: number, r1: number, q2: number, r2: number): number {
  const s1 = -q1 - r1;
  const s2 = -q2 - r2;
  return Math.max(Math.abs(q1 - q2), Math.abs(r1 - r2), Math.abs(s1 - s2));
}

function worldToHex(x: number, z: number): { q: number; r: number } {
  const HEX_SIZE = 1;
  const q = (Math.sqrt(3) / 3 * x - 1 / 3 * z) / HEX_SIZE;
  const r = (2 / 3 * z) / HEX_SIZE;

  const cubeX = q;
  const cubeZ = r;
  const cubeY = -cubeX - cubeZ;

  let rx = Math.round(cubeX);
  let ry = Math.round(cubeY);
  let rz = Math.round(cubeZ);

  const xDiff = Math.abs(rx - cubeX);
  const yDiff = Math.abs(ry - cubeY);
  const zDiff = Math.abs(rz - cubeZ);

  if (xDiff > yDiff && xDiff > zDiff) {
    rx = -ry - rz;
  } else if (yDiff > zDiff) {
    ry = -rx - rz;
  } else {
    rz = -rx - ry;
  }

  return { q: rx, r: rz };
}

type CastSpellPayload = {
  type: "pf2_cast_spell";
  casterIndex: number;
  spellName: string;
  spellLevel: number;
  targetId?: string;
  targetHex?: { q: number; r: number };
};

export const handlePF2CastSpell = async (
  socket: WebSocket,
  matchId: string,
  match: MatchState,
  player: Player,
  actorCombatant: ReturnType<typeof getCombatantByPlayerId>,
  payload: CastSpellPayload
): Promise<void> => {
  if (!actorCombatant) return;
  if (!isPF2Combatant(actorCombatant)) return;

  const character = getCharacterById(match, actorCombatant.characterId);
  if (!character || !isPF2Character(character)) {
    sendMessage(socket, { type: "error", message: "Character not found." });
    return;
  }

  const pf2Char = character as PF2CharacterSheet;
  const caster = pf2Char.spellcasters?.[payload.casterIndex];
  if (!caster) {
    sendMessage(socket, { type: "error", message: "No spellcaster at that index." });
    return;
  }

  const spellDef = getSpell(payload.spellName);
  const actionCost = typeof spellDef?.castActions === 'number' ? spellDef.castActions : 2;
  if (actorCombatant.actionsRemaining < actionCost) {
    sendMessage(socket, { type: "error", message: `Casting this spell requires ${actionCost} action(s).` });
    return;
  }

  const castResult = canCastSpell(
    caster,
    payload.spellLevel,
    payload.casterIndex,
    actorCombatant.spellSlotUsage,
    actorCombatant.focusPointsUsed,
  );

  if (!castResult.success) {
    sendMessage(socket, { type: "error", message: castResult.error ?? "Cannot cast spell." });
    return;
  }

  const spellAttack = calculateSpellAttack(caster, pf2Char.abilities, pf2Char.level);
  const spellDC = calculateSpellDC(caster, pf2Char.abilities, pf2Char.level);

  if (!spellDef) {
    let logEntry = `${pf2Char.name} casts ${payload.spellName}`;
    if (castResult.isCantrip) {
      logEntry += ` (cantrip)`;
    } else if (castResult.isFocus) {
      logEntry += ` (focus)`;
    } else {
      logEntry += ` (level ${payload.spellLevel})`;
    }
    logEntry += ` [resolve effects manually]`;

    const updatedCombatants = match.combatants.map(c => {
      if (c.playerId !== player.id) return c;
      if (!isPF2Combatant(c)) return c;

      const updated = { ...c, actionsRemaining: c.actionsRemaining - actionCost };

      if (castResult.isFocus) {
        updated.focusPointsUsed = c.focusPointsUsed + 1;
      } else if (!castResult.isCantrip) {
        const existingSlot = c.spellSlotUsage.find(
          s => s.casterIndex === payload.casterIndex && s.level === payload.spellLevel
        );
        if (existingSlot) {
          updated.spellSlotUsage = c.spellSlotUsage.map(s =>
            s.casterIndex === payload.casterIndex && s.level === payload.spellLevel
              ? { ...s, used: s.used + 1 }
              : s
          );
        } else {
          updated.spellSlotUsage = [...c.spellSlotUsage, {
            casterIndex: payload.casterIndex,
            level: payload.spellLevel,
            used: 1,
          }];
        }
      }

      return updated;
    });

    const finalState: MatchState = {
      ...match,
      combatants: updatedCombatants,
      log: [...match.log, logEntry],
    };

    state.matches.set(matchId, finalState);
    await updateMatchState(matchId, finalState);
    sendToMatch(matchId, { type: "match_state", state: finalState });
    return;
  }

  let logEntry = `${pf2Char.name} casts ${payload.spellName}`;
  if (castResult.isCantrip) {
    logEntry += ` (cantrip)`;
  } else if (castResult.isFocus) {
    logEntry += ` (focus)`;
  } else {
    logEntry += ` (level ${payload.spellLevel})`;
  }
  logEntry += ` [spell attack +${spellAttack}, DC ${spellDC}]`;

  const areaSize = spellDef.areaSize ?? spellDef.areaRadius;
  if (spellDef.targetType === 'area' && payload.targetHex && spellDef.areaShape === 'burst' && areaSize !== undefined) {
    const centerHex = payload.targetHex;
    const radius = areaSize;

    const affectedCombatants = match.combatants.filter(c => {
      if (!isPF2Combatant(c)) return false;
      const combatantHex = worldToHex(c.position.x, c.position.z);
      const distance = hexDistance(centerHex.q, centerHex.r, combatantHex.q, combatantHex.r);
      return distance <= radius;
    });

    logEntry += ` at hex (${centerHex.q}, ${centerHex.r}) affecting ${affectedCombatants.length} target(s)`;

    const tradition = caster.tradition.toLowerCase();
    const abilityKey = tradition === 'arcane' ? 'intelligence' 
      : tradition === 'divine' ? 'wisdom'
      : tradition === 'occult' ? 'charisma'
      : 'wisdom';
    const abilityMod = getAbilityModifier(pf2Char.abilities[abilityKey]);

    const heightenedFormula = getHeightenedDamage(spellDef, payload.spellLevel);
    const damageFormula = heightenedFormula.replace('{mod}', String(abilityMod));
    const baseDamageRoll = rollDamage(damageFormula, spellDef.damageType!);

    const updatedCombatants = match.combatants.map(c => {
      const isAffected = affectedCombatants.find(ac => ac.playerId === c.playerId);
      const isCaster = c.playerId === player.id;

      if (!isAffected && !isCaster) {
        return c;
      }

      if (!isPF2Combatant(c)) return c;

      const updated = { ...c };

      if (isAffected) {
        const targetChar = getCharacterById(match, c.characterId);
        if (targetChar && isPF2Character(targetChar)) {
          const pf2TargetChar = targetChar as PF2CharacterSheet;

          if (spellDef.damageFormula && spellDef.save) {
            const saveType = spellDef.save;
            const targetSave = pf2TargetChar.derived[`${saveType}Save` as keyof typeof pf2TargetChar.derived] as number;
            const saveRoll = rollCheck(targetSave, spellDC);

            let damageDealt = 0;
            if (saveRoll.degree === 'critical_failure') {
              damageDealt = baseDamageRoll.total * 2;
              logEntry += `\n  ${pf2TargetChar.name}: Critical Failure! ${damageDealt} ${spellDef.damageType} damage (doubled)`;
            } else if (saveRoll.degree === 'failure') {
              damageDealt = baseDamageRoll.total;
              logEntry += `\n  ${pf2TargetChar.name}: Failure! ${damageDealt} ${spellDef.damageType} damage`;
            } else if (saveRoll.degree === 'success') {
              damageDealt = Math.floor(baseDamageRoll.total / 2);
              logEntry += `\n  ${pf2TargetChar.name}: Success! ${damageDealt} ${spellDef.damageType} damage (half)`;
            } else {
              damageDealt = 0;
              logEntry += `\n  ${pf2TargetChar.name}: Critical Success! No damage`;
            }

            if (damageDealt > 0) {
              const newHP = Math.max(0, updated.currentHP - damageDealt);
              updated.currentHP = newHP;

              if (newHP <= 0) {
                const newDying = 1 + updated.wounded;
                const deathThreshold = 4 - updated.doomed;
                const isDead = newDying >= deathThreshold;

                updated.dying = isDead ? updated.dying : newDying;
                updated.statusEffects = isDead
                  ? [...updated.statusEffects.filter(e => e !== 'unconscious'), 'dead']
                  : [...updated.statusEffects.filter(e => e !== 'unconscious'), 'unconscious'];
                updated.conditions = isDead
                  ? updated.conditions
                  : [...updated.conditions.filter(cond => cond.condition !== 'unconscious'), { condition: 'unconscious' as const }];
              }
            }
          }
        }
      }

      if (isCaster) {
        updated.actionsRemaining = updated.actionsRemaining - actionCost;

        if (castResult.isFocus) {
          updated.focusPointsUsed += 1;
        } else if (!castResult.isCantrip) {
          const existingSlot = updated.spellSlotUsage.find(
            s => s.casterIndex === payload.casterIndex && s.level === payload.spellLevel
          );
          if (existingSlot) {
            updated.spellSlotUsage = updated.spellSlotUsage.map(s =>
              s.casterIndex === payload.casterIndex && s.level === payload.spellLevel
                ? { ...s, used: s.used + 1 }
                : s
            );
          } else {
            updated.spellSlotUsage = [...updated.spellSlotUsage, {
              casterIndex: payload.casterIndex,
              level: payload.spellLevel,
              used: 1,
            }];
          }
        }
      }

      return updated;
    });

    const finalState: MatchState = {
      ...match,
      combatants: updatedCombatants,
      log: [...match.log, logEntry],
    };

    state.matches.set(matchId, finalState);
    await updateMatchState(matchId, finalState);
    sendToMatch(matchId, { type: "match_state", state: finalState });
    return;
  }

  let targetCombatant: PF2CombatantState | undefined;
  let targetCharacter: PF2CharacterSheet | undefined;
  let damageDealt = 0;
  let healingApplied = 0;

  if (payload.targetId && (spellDef.damageFormula || spellDef.healFormula || spellDef.conditions)) {
    targetCombatant = match.combatants.find(c => c.playerId === payload.targetId) as PF2CombatantState | undefined;
    if (!targetCombatant || !isPF2Combatant(targetCombatant)) {
      sendMessage(socket, { type: "error", message: "Target not found." });
      return;
    }

    targetCharacter = getCharacterById(match, targetCombatant.characterId) as PF2CharacterSheet | undefined;
    if (!targetCharacter || !isPF2Character(targetCharacter)) {
      sendMessage(socket, { type: "error", message: "Target character not found." });
      return;
    }

    if (spellDef.damageFormula && spellDef.save) {
      const tradition = caster.tradition.toLowerCase();
      const abilityKey = tradition === 'arcane' ? 'intelligence' 
        : tradition === 'divine' ? 'wisdom'
        : tradition === 'occult' ? 'charisma'
        : 'wisdom';
      const abilityMod = getAbilityModifier(pf2Char.abilities[abilityKey]);

      const heightenedFormula = getHeightenedDamage(spellDef, payload.spellLevel);
      const damageFormula = heightenedFormula.replace('{mod}', String(abilityMod));
      const baseDamageRoll = rollDamage(damageFormula, spellDef.damageType!);

      const saveType = spellDef.save;
      const targetSave = targetCharacter.derived[`${saveType}Save` as keyof typeof targetCharacter.derived] as number;
      const saveRoll = rollCheck(targetSave, spellDC);

      logEntry += ` vs ${targetCharacter.name}'s ${saveType} save [${saveRoll.roll}+${saveRoll.modifier}=${saveRoll.total} vs DC ${spellDC}]`;

      if (saveRoll.degree === 'critical_failure') {
        damageDealt = baseDamageRoll.total * 2;
        logEntry += ` Critical Failure! ${damageDealt} ${spellDef.damageType} damage (doubled)`;
      } else if (saveRoll.degree === 'failure') {
        damageDealt = baseDamageRoll.total;
        logEntry += ` Failure! ${damageDealt} ${spellDef.damageType} damage`;
      } else if (saveRoll.degree === 'success') {
        damageDealt = Math.floor(baseDamageRoll.total / 2);
        logEntry += ` Success! ${damageDealt} ${spellDef.damageType} damage (half)`;
      } else {
        damageDealt = 0;
        logEntry += ` Critical Success! No damage`;
      }
    } else if (spellDef.damageFormula && spellDef.targetType === 'attack') {
      const tradition = caster.tradition.toLowerCase();
      const abilityKey = tradition === 'arcane' ? 'intelligence' 
        : tradition === 'divine' ? 'wisdom'
        : tradition === 'occult' ? 'charisma'
        : 'wisdom';
      const abilityMod = getAbilityModifier(pf2Char.abilities[abilityKey]);

      const targetAC = targetCharacter.derived.armorClass;
      const attackRoll = rollCheck(spellAttack, targetAC);

      logEntry += ` spell attack [${attackRoll.roll}+${attackRoll.modifier}=${attackRoll.total} vs AC ${targetAC}]`;

      const heightenedFormula = getHeightenedDamage(spellDef, payload.spellLevel);
      const damageFormula = heightenedFormula.replace('{mod}', String(abilityMod));

      if (attackRoll.degree === 'critical_success') {
        const damageRoll = rollDamage(damageFormula, spellDef.damageType!);
        damageDealt = damageRoll.total * 2;
        logEntry += ` Critical Hit! ${damageDealt} ${spellDef.damageType} damage (doubled)`;
      } else if (attackRoll.degree === 'success') {
        const damageRoll = rollDamage(damageFormula, spellDef.damageType!);
        damageDealt = damageRoll.total;
        logEntry += ` Hit! ${damageDealt} ${spellDef.damageType} damage`;
      } else if (attackRoll.degree === 'critical_failure') {
        logEntry += ` Critical Miss!`;
      } else {
        logEntry += ` Miss!`;
      }
    } else if (spellDef.damageFormula && !spellDef.save) {
      const tradition = caster.tradition.toLowerCase();
      const abilityKey = tradition === 'arcane' ? 'intelligence' 
        : tradition === 'divine' ? 'wisdom'
        : tradition === 'occult' ? 'charisma'
        : 'wisdom';
      const abilityMod = getAbilityModifier(pf2Char.abilities[abilityKey]);

      const damageFormula = spellDef.damageFormula.replace('{mod}', String(abilityMod));
      const damageRoll = rollDamage(damageFormula, spellDef.damageType!);
      damageDealt = damageRoll.total;
      logEntry += ` dealing ${damageDealt} ${spellDef.damageType} damage`;
    }

    if (spellDef.healFormula) {
      const healRoll = rollDamage(spellDef.healFormula, 'positive');
      healingApplied = healRoll.total;
      logEntry += ` healing ${targetCharacter.name} for ${healingApplied} HP`;
    }

    if (spellDef.conditions && spellDef.save) {
      const saveType = spellDef.save;
      const targetSave = targetCharacter.derived[`${saveType}Save` as keyof typeof targetCharacter.derived] as number;
      const saveRoll = rollCheck(targetSave, spellDC);

      if (saveRoll.degree === 'failure' || saveRoll.degree === 'critical_failure') {
        logEntry += ` ${targetCharacter.name} is ${spellDef.conditions[0].condition}`;
      } else {
        logEntry += ` ${targetCharacter.name} resists the effect`;
      }
    }
  }

  const updatedCombatants = match.combatants.map(c => {
    if (c.playerId === payload.targetId && targetCombatant && isPF2Combatant(c)) {
      let updated = { ...c };

      if (damageDealt > 0) {
        const newHP = Math.max(0, c.currentHP - damageDealt);
        updated.currentHP = newHP;

        if (newHP <= 0) {
          const newDying = 1 + c.wounded;
          const deathThreshold = 4 - c.doomed;
          const isDead = newDying >= deathThreshold;

          updated.dying = isDead ? c.dying : newDying;
          updated.statusEffects = isDead
            ? [...c.statusEffects.filter(e => e !== 'unconscious'), 'dead']
            : [...c.statusEffects.filter(e => e !== 'unconscious'), 'unconscious'];
          updated.conditions = isDead
            ? c.conditions
            : [...c.conditions.filter(cond => cond.condition !== 'unconscious'), { condition: 'unconscious' as const }];
        }
      }

      if (healingApplied > 0 && targetCharacter) {
        updated = applyHealing(updated, healingApplied, targetCharacter.derived.hitPoints);
      }

      if (spellDef.conditions && spellDef.save && targetCharacter) {
        const saveType = spellDef.save;
        const targetSave = targetCharacter.derived[`${saveType}Save` as keyof typeof targetCharacter.derived] as number;
        const saveRoll = rollCheck(targetSave, spellDC);

        if (saveRoll.degree === 'failure' || saveRoll.degree === 'critical_failure') {
          updated.conditions = [...updated.conditions, ...spellDef.conditions];
        }
      }

      return updated;
    }

    if (c.playerId !== player.id) return c;
    if (!isPF2Combatant(c)) return c;

    const newActionsRemaining = c.actionsRemaining - actionCost;

    let newSlotUsage = [...c.spellSlotUsage];
    let newFocusUsed = c.focusPointsUsed;

    if (castResult.isFocus) {
      newFocusUsed += 1;
    } else if (!castResult.isCantrip) {
      const existingSlot = newSlotUsage.find(
        s => s.casterIndex === payload.casterIndex && s.level === payload.spellLevel
      );
      if (existingSlot) {
        newSlotUsage = newSlotUsage.map(s =>
          s.casterIndex === payload.casterIndex && s.level === payload.spellLevel
            ? { ...s, used: s.used + 1 }
            : s
        );
      } else {
        newSlotUsage = [...newSlotUsage, {
          casterIndex: payload.casterIndex,
          level: payload.spellLevel,
          used: 1,
        }];
      }
    }

    return {
      ...c,
      actionsRemaining: newActionsRemaining,
      spellSlotUsage: newSlotUsage,
      focusPointsUsed: newFocusUsed,
    };
  });

  const finalState: MatchState = {
    ...match,
    combatants: updatedCombatants,
    log: [...match.log, logEntry],
  };

  state.matches.set(matchId, finalState);
  await updateMatchState(matchId, finalState);
  sendToMatch(matchId, { type: "match_state", state: finalState });
};
