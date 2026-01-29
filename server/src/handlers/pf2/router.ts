import type { WebSocket } from "ws";
import type { MatchState, Player } from "../../../../shared/types";
import type { CombatantState } from "../../../../shared/rulesets";
import { sendMessage } from "../../helpers";
import { handlePF2AttackAction } from "./attack";
import { handlePF2DropProne, handlePF2Stand, handlePF2Step, handlePF2RaiseShield } from "./actions";
import { handlePF2RequestMove, handlePF2Stride } from "./stride";
import { advanceTurn } from "../../rulesetHelpers";
import { state } from "../../state";
import { updateMatchState } from "../../db";
import { sendToMatch } from "../../helpers";
import { scheduleBotTurn } from "../../bot";

type PF2ActionPayload = 
  | { type: "attack"; targetId: string }
  | { type: "pf2_drop_prone" }
  | { type: "pf2_stand" }
  | { type: "pf2_step"; to: { q: number; r: number } }
  | { type: "pf2_raise_shield" }
  | { type: "pf2_request_move"; mode: "stride" }
  | { type: "pf2_stride"; to: { q: number; r: number } }
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
    
    case "pf2_drop_prone":
      return handlePF2DropProne(socket, matchId, match, player, actorCombatant);
    
    case "pf2_stand":
      return handlePF2Stand(socket, matchId, match, player, actorCombatant);
    
    case "pf2_step":
      return handlePF2Step(socket, matchId, match, player, actorCombatant, payload);
    
    case "pf2_raise_shield":
      return handlePF2RaiseShield(socket, matchId, match, player, actorCombatant);
    
    case "pf2_request_move":
      return handlePF2RequestMove(socket, matchId, match, player, actorCombatant, payload);

    case "pf2_stride":
      return handlePF2Stride(socket, matchId, match, player, actorCombatant, payload);
    
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
