import type { WebSocket } from "ws";
import type { MatchState, Player } from "../../../../shared/types";
import { isPF2Character } from "../../../../shared/types";
import type { PF2CharacterSheet } from "../../../../shared/rulesets/pf2/characterSheet";
import { isPF2Combatant } from "../../../../shared/rulesets";
import { canCastSpell, calculateSpellAttack, calculateSpellDC } from "../../../../shared/rulesets/pf2/rules";
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

  let logEntry = `${pf2Char.name} casts ${payload.spellName}`;
  if (castResult.isCantrip) {
    logEntry += ` (cantrip)`;
  } else if (castResult.isFocus) {
    logEntry += ` (focus)`;
  } else {
    logEntry += ` (level ${payload.spellLevel})`;
  }
  logEntry += ` [spell attack +${spellAttack}, DC ${spellDC}]`;

  const updatedCombatants = match.combatants.map(c => {
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
