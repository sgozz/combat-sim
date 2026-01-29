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
import { getSpell } from "../../../../shared/rulesets/pf2/spellData";
import type { PF2CombatantState } from "../../../../shared/rulesets/pf2/types";
import { state } from "../../state";
import { updateMatchState } from "../../db";
import {
  sendMessage,
  sendToMatch,
  getCombatantByPlayerId,
  getCharacterById,
} from "../../helpers";

type CastSpellPayload = {
  type: "pf2_cast_spell";
  casterIndex: number;
  spellName: string;
  spellLevel: number;
  targetId?: string;
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

  if (actorCombatant.actionsRemaining < 2) {
    sendMessage(socket, { type: "error", message: "Casting a spell requires 2 actions." });
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

  const spellDef = getSpell(payload.spellName);
  if (!spellDef) {
    sendMessage(socket, { type: "error", message: `Spell "${payload.spellName}" not found in database.` });
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

      const damageFormula = spellDef.damageFormula.replace('{mod}', String(abilityMod));
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

    const newActionsRemaining = c.actionsRemaining - 2;

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
