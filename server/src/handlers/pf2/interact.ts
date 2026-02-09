import type { WebSocket } from "ws";
import type { MatchState, Player } from "../../../../shared/types";
import type { CombatantState } from "../../../../shared/rulesets";
import { isPF2Combatant } from "../../../../shared/rulesets";
import type { EquippedItem, EquipmentSlot } from "../../../../shared/rulesets/gurps/types";
import { isPF2Character } from "../../../../shared/rulesets/characterSheet";
import { advanceTurn } from "../../rulesetHelpers";
import { state } from "../../state";
import { updateMatchState } from "../../db";
import { sendMessage, sendToMatch, getCharacterById } from "../../helpers";
import { scheduleBotTurn } from "../../bot";

export const handlePF2Interact = async (
  socket: WebSocket,
  matchId: string,
  match: MatchState,
  player: Player,
  actorCombatant: CombatantState,
  payload: { type: 'pf2_interact'; action: 'draw' | 'sheathe'; itemId: string; targetSlot?: string }
): Promise<void> => {
  if (!isPF2Combatant(actorCombatant)) return;

  const actionsRemaining = actorCombatant.actionsRemaining;
  if (actionsRemaining < 1) {
    sendMessage(socket, { type: "error", message: "No actions remaining." });
    return;
  }

  const character = getCharacterById(match, actorCombatant.characterId);
  if (!character || !isPF2Character(character)) {
    sendMessage(socket, { type: "error", message: "Character not found." });
    return;
  }

  const weapon = character.weapons.find(w => w.id === payload.itemId);
  if (!weapon) {
    sendMessage(socket, { type: "error", message: "Weapon not found in inventory." });
    return;
  }

  const currentEquipped = actorCombatant.equipped;
  let newEquipped: EquippedItem[] = [...currentEquipped];
  let logMsg = '';

  switch (payload.action) {
    case 'draw': {
      const alreadyEquipped = currentEquipped.find(e => e.equipmentId === payload.itemId);
      if (alreadyEquipped?.ready) {
        sendMessage(socket, { type: "error", message: "Weapon already drawn." });
        return;
      }

      const targetSlot: EquipmentSlot = (payload.targetSlot as EquipmentSlot) ?? 'right_hand';
      const slotOccupied = currentEquipped.find(e => e.slot === targetSlot && e.ready);
      if (slotOccupied) {
        sendMessage(socket, { type: "error", message: `${targetSlot} is occupied. Sheathe current item first.` });
        return;
      }

      if (alreadyEquipped) {
        newEquipped = newEquipped.map(e =>
          e.equipmentId === payload.itemId ? { ...e, slot: targetSlot, ready: true } : e
        );
      } else {
        newEquipped.push({ equipmentId: payload.itemId, slot: targetSlot, ready: true });
      }

      logMsg = `${character.name} draws ${weapon.name}.`;
      break;
    }

    case 'sheathe': {
      const equippedItem = currentEquipped.find(e => e.equipmentId === payload.itemId);
      if (!equippedItem || !equippedItem.ready) {
        sendMessage(socket, { type: "error", message: "Weapon not in hand." });
        return;
      }

      const storageSlot: EquipmentSlot = (payload.targetSlot as EquipmentSlot) ?? 'belt';
      newEquipped = newEquipped.map(e =>
        e.equipmentId === payload.itemId ? { ...e, slot: storageSlot, ready: false } : e
      );

      logMsg = `${character.name} sheathes ${weapon.name}.`;
      break;
    }
  }

  const newActionsRemaining = actionsRemaining - 1;

  const updatedCombatants = match.combatants.map(c =>
    c.playerId === player.id && isPF2Combatant(c)
      ? { ...c, equipped: newEquipped, actionsRemaining: newActionsRemaining }
      : c
  );

  let updated: MatchState = {
    ...match,
    combatants: updatedCombatants,
    log: [...match.log, logMsg],
    turnMovement: undefined,
    reachableHexes: undefined,
  };

  if (newActionsRemaining <= 0) {
    updated = advanceTurn(updated);
  }

  state.matches.set(matchId, updated);
  await updateMatchState(matchId, updated);
  await sendToMatch(matchId, { type: "match_state", state: updated });

  if (newActionsRemaining <= 0) {
    scheduleBotTurn(matchId, updated);
  }
};
