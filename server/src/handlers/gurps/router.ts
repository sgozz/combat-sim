import type { WebSocket } from "ws";
import type { MatchState, Player } from "../../../../shared/types";
import type { CombatantState, CombatActionPayload } from "../../../../shared/rulesets";
import { isGurpsCombatant } from "../../../../shared/rulesets";
import type { GurpsCombatActionPayload } from "../../../../shared/rulesets/gurps/types";
import { sendMessage, calculateHexDistance, calculateFacing, getCharacterById } from "../../helpers";
import {
  handleMoveStep,
  handleRotate,
  handleUndoMovement,
  handleConfirmMovement,
  handleSkipMovement,
  handleEnterCloseCombat,
  handleExitCloseCombat,
  handleGrapple,
  handleBreakFree,
  handleReadyAction,
  handleAttackAction,
  resolveDefenseChoice,
} from "./index";
import { advanceTurn } from "../../rulesetHelpers";
import { state } from "../../state";
import { updateMatchState } from "../../db";
import { sendToMatch } from "../../helpers";
import { scheduleBotTurn } from "../../bot";
import { getServerAdapter } from "../../../../shared/rulesets/serverAdapter";
import { assertRulesetId } from "../../../../shared/rulesets/defaults";

export const handleGurpsAction = async (
  socket: WebSocket,
  matchId: string,
  match: MatchState,
  player: Player,
  actorCombatant: CombatantState,
  payload: any
): Promise<void> => {
  if (!isGurpsCombatant(actorCombatant)) {
    sendMessage(socket, { type: "error", message: "Not a GURPS combatant." });
    return;
  }

  if (payload.type === "select_maneuver") {
    if (match.turnMovement?.phase === "moving") {
      sendMessage(socket, { type: "error", message: "Cannot change maneuver during movement." });
      return;
    }

    const previousManeuver = actorCombatant.maneuver;
    const newManeuver = payload.maneuver;
    const aoaVariant = payload.aoaVariant ?? null;
    const aodVariant = payload.aodVariant ?? null;

    if (newManeuver === "all_out_attack" && !aoaVariant) {
      sendMessage(socket, { type: "error", message: "All-Out Attack requires a variant (determined/strong/double/feint)." });
      return;
    }

    if (newManeuver === "all_out_defense" && !aodVariant) {
      sendMessage(socket, { type: "error", message: "All-Out Defense requires a variant (increased_dodge/increased_parry/increased_block/double)." });
      return;
    }

     const updatedCombatants = match.combatants.map((c) => {
       if (c.playerId !== player.id) return c;
       if (!isGurpsCombatant(c)) return c;

       let aimTurns = c.aimTurns;
       let aimTargetId = c.aimTargetId;
       let evaluateBonus = c.evaluateBonus;
       let evaluateTargetId = c.evaluateTargetId;

      if (newManeuver === "aim") {
        if (previousManeuver === "aim") {
          aimTurns = Math.min(aimTurns + 1, 3);
        } else {
          aimTurns = 1;
        }
      } else {
        aimTurns = 0;
        aimTargetId = null;
      }

      if (newManeuver !== "evaluate" && newManeuver !== "attack" && newManeuver !== "all_out_attack" && newManeuver !== "move_and_attack") {
        evaluateBonus = 0;
        evaluateTargetId = null;
      }

      const attacksRemaining = newManeuver === "all_out_attack" && aoaVariant === "double" ? 2 : 1;

      return { ...c, maneuver: newManeuver, aoaVariant, aodVariant, aimTurns, aimTargetId, evaluateBonus, evaluateTargetId, attacksRemaining };
    });

    let logMsg = `${player.name} chooses ${newManeuver.replace(/_/g, " ")}`;
    if (newManeuver === "all_out_attack" && aoaVariant) {
      logMsg += ` (${aoaVariant})`;
    }
    if (newManeuver === "all_out_defense" && aodVariant) {
      logMsg += ` (${aodVariant.replace(/_/g, " ")})`;
    }
     const updatedActor = updatedCombatants.find((c) => c.playerId === player.id);
     if (newManeuver === "aim" && updatedActor && isGurpsCombatant(updatedActor) && updatedActor.aimTurns > 1) {
       logMsg += ` (turn ${updatedActor.aimTurns})`;
    }
    logMsg += ".";

    const actorCharacter = getCharacterById(match, actorCombatant.characterId);
    const adapter = getServerAdapter(assertRulesetId(match.rulesetId));

    let basicMove = 5;
    if (actorCharacter && "attributes" in actorCharacter && "equipment" in actorCharacter) {
      const gurpsDerived = actorCharacter.derived as { basicMove?: number };
      const baseMove = gurpsDerived.basicMove ?? 5;
      basicMove = baseMove;
      if (adapter.calculateEncumbrance) {
        const encumbrance = adapter.calculateEncumbrance(actorCharacter.attributes.strength ?? 10, actorCharacter.equipment ?? []);
        basicMove = Math.max(1, baseMove + encumbrance.movePenalty);
      }
    }
    const turnMovement = adapter.initializeTurnMovement(
      adapter.gridToHex(actorCombatant.position),
      actorCombatant.facing,
      newManeuver,
      basicMove,
      actorCombatant.posture
    );

    const occupiedHexes = match.combatants
      .filter((c) => c.playerId !== player.id)
      .map((c) => adapter.gridToHex(c.position));

    const reachableHexes = turnMovement.phase === "moving" ? adapter.calculateReachableHexesInfo(turnMovement, occupiedHexes) : [];

    const updated: MatchState = {
      ...match,
      combatants: updatedCombatants,
      log: [...match.log, logMsg],
      turnMovement,
      reachableHexes,
    };
    state.matches.set(matchId, updated);
    await updateMatchState(matchId, updated);
    await sendToMatch(matchId, { type: "match_state", state: updated });
    return;
  }

  if (!actorCombatant.maneuver) {
    sendMessage(socket, { type: "error", message: "Select a maneuver first." });
    return;
  }

  if (payload.type === "move_step") {
    await handleMoveStep(socket, matchId, match, player, actorCombatant, payload as CombatActionPayload & { type: "move_step" });
    return;
  }

  if (payload.type === "rotate") {
    await handleRotate(socket, matchId, match, player, actorCombatant, payload as CombatActionPayload & { type: "rotate" });
    return;
  }

  if (payload.type === "undo_movement") {
    await handleUndoMovement(socket, matchId, match, player, actorCombatant);
    return;
  }

  if (payload.type === "confirm_movement") {
    await handleConfirmMovement(socket, matchId, match, player, actorCombatant);
    return;
  }

  if (payload.type === "skip_movement") {
    await handleSkipMovement(socket, matchId, match, player, actorCombatant);
    return;
  }

  if (payload.type === "turn_left" || payload.type === "turn_right") {
    if (actorCombatant.inCloseCombatWith) {
      sendMessage(socket, { type: "error", message: "Cannot turn while in close combat." });
      return;
    }
    const delta = payload.type === "turn_right" ? 1 : -1;
    const newFacing = (actorCombatant.facing + delta + 6) % 6;
    const updatedCombatants = match.combatants.map((c) => (c.playerId === player.id ? { ...c, facing: newFacing } : c));

    const dirName = payload.type === "turn_right" ? "right" : "left";
    const updated = {
      ...match,
      combatants: updatedCombatants,
      log: [...match.log, `${player.name} turns ${dirName}.`],
    };

    state.matches.set(matchId, updated);
    await updateMatchState(matchId, updated);
    await sendToMatch(matchId, { type: "match_state", state: updated });
    return;
  }

  if (payload.type === "aim_target") {
    if (actorCombatant.maneuver !== "aim") {
      sendMessage(socket, { type: "error", message: "Must select Aim maneuver first." });
      return;
    }
    const targetCombatant = match.combatants.find((c) => c.playerId === payload.targetId);
    if (!targetCombatant) {
      sendMessage(socket, { type: "error", message: "Target not found." });
      return;
    }
    const targetPlayer = match.players.find((p) => p.id === payload.targetId);
    const updatedCombatants = match.combatants.map((c) => (c.playerId === player.id ? { ...c, aimTargetId: payload.targetId } : c));
    const updated = advanceTurn({
      ...match,
      combatants: updatedCombatants,
      log: [...match.log, `${player.name} aims at ${targetPlayer?.name ?? "target"}.`],
    });
    state.matches.set(matchId, updated);
    await updateMatchState(matchId, updated);
    await sendToMatch(matchId, { type: "match_state", state: updated });
    scheduleBotTurn(matchId, updated);
    return;
  }

  if (payload.type === "evaluate_target") {
    if (actorCombatant.maneuver !== "evaluate") {
      sendMessage(socket, { type: "error", message: "Must select Evaluate maneuver first." });
      return;
    }
    const targetCombatant = match.combatants.find((c) => c.playerId === payload.targetId);
    if (!targetCombatant) {
      sendMessage(socket, { type: "error", message: "Target not found." });
      return;
    }
    const targetPlayer = match.players.find((p) => p.id === payload.targetId);

    const isSameTarget = actorCombatant.evaluateTargetId === payload.targetId;
    const newBonus = isSameTarget ? Math.min(3, actorCombatant.evaluateBonus + 1) : 1;

    const updatedCombatants = match.combatants.map((c) =>
      c.playerId === player.id ? { ...c, evaluateTargetId: payload.targetId, evaluateBonus: newBonus } : c
    );

    const bonusStr = newBonus > 1 ? ` (+${newBonus})` : " (+1)";
    const updated = advanceTurn({
      ...match,
      combatants: updatedCombatants,
      log: [...match.log, `${player.name} evaluates ${targetPlayer?.name ?? "target"}${bonusStr}.`],
    });
    state.matches.set(matchId, updated);
    await updateMatchState(matchId, updated);
    await sendToMatch(matchId, { type: "match_state", state: updated });
    scheduleBotTurn(matchId, updated);
    return;
  }

  if (payload.type === "set_wait_trigger") {
    if (actorCombatant.maneuver !== "wait") {
      sendMessage(socket, { type: "error", message: "Must select Wait maneuver first." });
      return;
    }
    const trigger = payload.trigger;

    const conditionDesc: Record<string, string> = {
      enemy_moves_adjacent: "an enemy moves adjacent",
      enemy_attacks_me: "an enemy attacks them",
      enemy_attacks_ally: "an enemy attacks an ally",
      enemy_enters_reach: "an enemy enters weapon reach",
    };
    const actionDesc = trigger.action === "attack" ? "attack" : trigger.action === "move" ? "move" : "ready";

    const updatedCombatants = match.combatants.map((c) => (c.playerId === player.id ? { ...c, waitTrigger: trigger as any } : c));

    const updated = advanceTurn({
      ...match,
      combatants: updatedCombatants,
      log: [...match.log, `${player.name} waits to ${actionDesc} when ${conditionDesc[trigger.condition] ?? trigger.condition}.`],
    });
    state.matches.set(matchId, updated);
    await updateMatchState(matchId, updated);
    await sendToMatch(matchId, { type: "match_state", state: updated });
    scheduleBotTurn(matchId, updated);
    return;
  }

  if (payload.type === "end_turn") {
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

  if (payload.type === "change_posture") {
    const newPosture = payload.posture as any;
    const oldPosture = actorCombatant.posture;
    if (newPosture === oldPosture) {
      sendMessage(socket, { type: "error", message: "Already in that posture." });
      return;
    }

    const adapter = getServerAdapter(assertRulesetId(match.rulesetId));
    const isFreeChange = adapter.canChangePostureFree!(oldPosture, newPosture);

    if (!isFreeChange && actorCombatant.maneuver !== "change_posture") {
      sendMessage(socket, { type: "error", message: `Changing from ${oldPosture} to ${newPosture} requires Change Posture maneuver.` });
      return;
    }

    const updatedCombatants = match.combatants.map((c) => (c.playerId === player.id ? { ...c, posture: newPosture as any } : c));

    if (isFreeChange) {
      const updated: MatchState = {
        ...match,
        combatants: updatedCombatants,
        log: [...match.log, `${player.name} changes to ${newPosture} posture (free action).`],
      };
      state.matches.set(matchId, updated);
      await updateMatchState(matchId, updated);
      await sendToMatch(matchId, { type: "match_state", state: updated });
    } else {
      const updated = advanceTurn({
        ...match,
        combatants: updatedCombatants,
        log: [...match.log, `${player.name} changes to ${newPosture} posture.`],
      });
      state.matches.set(matchId, updated);
      await updateMatchState(matchId, updated);
      await sendToMatch(matchId, { type: "match_state", state: updated });
      scheduleBotTurn(matchId, updated);
    }
    return;
  }

  if (payload.type === "move") {
    if (actorCombatant.inCloseCombatWith) {
      sendMessage(socket, { type: "error", message: "Cannot move while in close combat. Use Exit Close Combat first." });
      return;
    }

    const actorCharacter = getCharacterById(match, actorCombatant.characterId);
    if (!actorCharacter || !("attributes" in actorCharacter)) {
      sendMessage(socket, { type: "error", message: "Character not found." });
      return;
    }

    const occupant = match.combatants.find(
      (c) => c.playerId !== player.id && c.position.x === payload.position.x && c.position.z === payload.position.z
    );
    if (occupant) {
      sendMessage(socket, { type: "error", message: "Hex is occupied. Use Enter Close Combat to share hex." });
      return;
    }

    const distance = calculateHexDistance(actorCombatant.position, { x: payload.position.x, y: 0, z: payload.position.z });
    const adapter = getServerAdapter(assertRulesetId(match.rulesetId));
    const postureMods = adapter.getPostureModifiers!(actorCombatant.posture);

    const gurpsDerived = actorCharacter.derived as { basicMove?: number };
    const basicMoveVal = gurpsDerived.basicMove ?? 5;

    let allowed = Math.floor(basicMoveVal * postureMods.moveMultiplier);
    const m = actorCombatant.maneuver;

    if (m === "do_nothing" || m === "all_out_defense") {
      if (m === "do_nothing") allowed = 0;
      else allowed = Math.min(allowed, 1);
    } else if (m === "attack" || m === "all_out_attack" || m === "aim") {
      if (m === "all_out_attack") {
        allowed = Math.min(allowed, Math.floor(basicMoveVal / 2));
      } else {
        if (actorCombatant.statusEffects.includes("has_stepped")) {
          sendMessage(socket, { type: "error", message: "Already stepped this turn." });
          return;
        }
        allowed = Math.min(allowed, 1);
      }
    }

    if (distance > allowed) {
      sendMessage(socket, { type: "error", message: `Move exceeds allowed for ${m} (${allowed}).` });
      return;
    }
    const newFacing = calculateFacing(actorCombatant.position, { x: payload.position.x, y: 0, z: payload.position.z });
    const updatedCombatants = match.combatants.map((combatant) =>
      combatant.playerId === player.id
        ? {
            ...combatant,
            position: { x: payload.position.x, y: 0, z: payload.position.z },
            facing: newFacing,
            statusEffects: [...combatant.statusEffects, "has_stepped"],
          }
        : combatant
    );

    const allowsActionAfterMove = m === "attack" || m === "aim" || m === "move_and_attack";

    if (allowsActionAfterMove) {
      const moveVerb = m === "move_and_attack" ? "moves" : "steps";
      const updated: MatchState = {
        ...match,
        combatants: updatedCombatants,
        log: [...match.log, `${player.name} ${moveVerb} to (${payload.position.x}, ${payload.position.z}).`],
      };
      state.matches.set(matchId, updated);
      await updateMatchState(matchId, updated);
      await sendToMatch(matchId, { type: "match_state", state: updated });
      return;
    }

    const updated = advanceTurn({
      ...match,
      combatants: updatedCombatants,
      log: [...match.log, `${player.name} moves to (${payload.position.x}, ${payload.position.z}).`],
    });
    state.matches.set(matchId, updated);
    await updateMatchState(matchId, updated);
    await sendToMatch(matchId, { type: "match_state", state: updated });
    scheduleBotTurn(matchId, updated);
    return;
  }

  if (payload.type === "defend") {
    if (match.pendingDefense && match.pendingDefense.defenderId === player.id) {
      await resolveDefenseChoice(matchId, match, payload as CombatActionPayload & { type: "defend" });
      return;
    }

    const updated = advanceTurn({
      ...match,
      combatants: match.combatants.map((combatant) =>
        combatant.playerId === player.id ? { ...combatant, statusEffects: [...combatant.statusEffects, "defending"] } : combatant
      ),
      log: [...match.log, `${player.name} takes a defensive posture.`],
    });
    state.matches.set(matchId, updated);
    await updateMatchState(matchId, updated);
    await sendToMatch(matchId, { type: "match_state", state: updated });
    scheduleBotTurn(matchId, updated);
    return;
  }

  if (payload.type === "attack") {
    await handleAttackAction(socket, matchId, match, player, actorCombatant, payload as CombatActionPayload & { type: "attack" });
    return;
  }

  if (payload.type === "ready_action") {
    await handleReadyAction(socket, matchId, match, player, actorCombatant, payload as CombatActionPayload & { type: "ready_action" });
    return;
  }

  if (payload.type === "enter_close_combat") {
    await handleEnterCloseCombat(socket, matchId, match, player, actorCombatant, payload as CombatActionPayload & { type: "enter_close_combat" });
    return;
  }

  if (payload.type === "exit_close_combat") {
    await handleExitCloseCombat(socket, matchId, match, player, actorCombatant);
    return;
  }

  if (payload.type === "grapple") {
    await handleGrapple(socket, matchId, match, player, actorCombatant, payload as CombatActionPayload & { type: "grapple" });
    return;
  }

  if (payload.type === "break_free") {
    await handleBreakFree(socket, matchId, match, player, actorCombatant);
    return;
  }

  sendMessage(socket, { type: "error", message: "Action handling not implemented." });
};
