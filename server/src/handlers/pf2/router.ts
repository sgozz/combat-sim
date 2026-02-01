import type { WebSocket } from "ws";
import type { MatchState, Player } from "../../../../shared/types";
import type { CombatantState } from "../../../../shared/rulesets";
import { sendMessage } from "../../helpers";
import { handlePF2AttackAction, handlePF2PowerAttack, handlePF2SuddenCharge, handlePF2IntimidatingStrike } from "./attack";
import { handlePF2DropProne, handlePF2Stand, handlePF2Step, handlePF2RaiseShield } from "./actions";
import { handlePF2RequestMove, handlePF2Stride } from "./stride";
import { handlePF2ReactionChoice } from "./reaction";
import { handlePF2CastSpell } from "./spell";
import { handlePF2Grapple, handlePF2Trip, handlePF2Disarm, handlePF2Feint, handlePF2Demoralize } from "./skill-actions";
import { advanceTurn } from "../../rulesetHelpers";
import { state } from "../../state";
import { updateMatchState } from "../../db";
import { sendToMatch } from "../../helpers";
import { scheduleBotTurn } from "../../bot";

type PF2ActionPayload = 
  | { type: "attack"; targetId: string }
  | { type: "pf2_power_attack"; targetId: string }
  | { type: "pf2_sudden_charge"; targetHex: { q: number; r: number }; strikeTargetId: string }
  | { type: "pf2_intimidating_strike"; targetId: string }
  | { type: "pf2_drop_prone" }
  | { type: "pf2_stand" }
  | { type: "pf2_step"; to: { q: number; r: number } }
  | { type: "pf2_raise_shield" }
  | { type: "pf2_request_move"; mode: "stride" }
  | { type: "pf2_stride"; to: { q: number; r: number } }
  | { type: "pf2_reaction_choice"; choice: 'aoo' | 'decline' }
  | { type: "pf2_cast_spell"; casterIndex: number; spellName: string; spellLevel: number; targetId?: string; isFocus?: boolean }
  | { type: "pf2_grapple"; targetId: string }
  | { type: "pf2_trip"; targetId: string }
  | { type: "pf2_disarm"; targetId: string }
  | { type: "pf2_feint"; targetId: string }
  | { type: "pf2_demoralize"; targetId: string }
  | { type: "end_turn" }
  | { type: "surrender" };

export const handlePF2Action = async (
  socket: WebSocket,
  matchId: string,
  match: MatchState,
  player: Player,
  actorCombatant: CombatantState,
  payload: PF2ActionPayload
): Promise<void> => {
  switch (payload.type) {
    case "attack":
      return handlePF2AttackAction(socket, matchId, match, player, actorCombatant, payload);
    
    case "pf2_power_attack":
      return handlePF2PowerAttack(socket, matchId, match, player, actorCombatant, payload);
    
    case "pf2_sudden_charge":
      return handlePF2SuddenCharge(socket, matchId, match, player, actorCombatant, payload);
    
    case "pf2_intimidating_strike":
      return handlePF2IntimidatingStrike(socket, matchId, match, player, actorCombatant, payload);
    
    case "pf2_drop_prone":
      return handlePF2DropProne(socket, matchId, match, player, actorCombatant);
    
    case "pf2_stand":
      return handlePF2Stand(socket, matchId, match, player, actorCombatant);
    
    case "pf2_step":
      return handlePF2Step(socket, matchId, match, player, actorCombatant, payload);
    
    case "pf2_raise_shield":
      return handlePF2RaiseShield(socket, matchId, match, player, actorCombatant);
    
    case "pf2_request_move":
      return handlePF2RequestMove(socket, matchId, match, player, actorCombatant);

    case "pf2_stride":
      return handlePF2Stride(socket, matchId, match, player, actorCombatant, payload);
    
    case "pf2_reaction_choice":
      return handlePF2ReactionChoice(socket, matchId, match, player, payload);

    case "pf2_cast_spell":
      return handlePF2CastSpell(socket, matchId, match, player, actorCombatant, payload);

    case "pf2_grapple":
      return handlePF2Grapple(socket, matchId, match, player, actorCombatant, payload);

    case "pf2_trip":
      return handlePF2Trip(socket, matchId, match, player, actorCombatant, payload);

    case "pf2_disarm":
      return handlePF2Disarm(socket, matchId, match, player, actorCombatant, payload);

    case "pf2_feint":
      return handlePF2Feint(socket, matchId, match, player, actorCombatant, payload);

    case "pf2_demoralize":
      return handlePF2Demoralize(socket, matchId, match, player, actorCombatant, payload);

    case "end_turn": {
      const updated = advanceTurn({
        ...match,
        log: [...match.log, `${player.name} ends their turn.`],
      });
      state.matches.set(matchId, updated);
      await updateMatchState(matchId, updated);
      await sendToMatch(matchId, { type: "match_state", state: updated });
      scheduleBotTurn(matchId, updated);
      return;
    }
    
    default:
      sendMessage(socket, { type: "error", message: `Unknown PF2 action: ${(payload as { type: string }).type}` });
  }
};
