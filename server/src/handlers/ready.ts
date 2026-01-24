import type { WebSocket } from "ws";
import type {
  MatchState,
  Player,
  CombatActionPayload,
  EquippedItem,
  EquipmentSlot,
} from "../../../shared/types";
import { advanceTurn } from "../rulesetHelpers";
import { state } from "../state";
import { updateMatchState } from "../db";
import { sendMessage, sendToMatch, getCombatantByPlayerId, getCharacterById } from "../helpers";
import { scheduleBotTurn } from "../bot";

export const handleReadyAction = async (
  socket: WebSocket,
  matchId: string,
  match: MatchState,
  player: Player,
  actorCombatant: ReturnType<typeof getCombatantByPlayerId>,
  payload: CombatActionPayload & { type: "ready_action" }
): Promise<void> => {
  if (!actorCombatant) return;
  
  if (actorCombatant.maneuver !== 'ready') {
    sendMessage(socket, { type: "error", message: "Must select Ready maneuver first." });
    return;
  }
  
  const actorCharacter = getCharacterById(match, actorCombatant.characterId);
  if (!actorCharacter) {
    sendMessage(socket, { type: "error", message: "Character not found." });
    return;
  }
  
  const item = actorCharacter.equipment.find(e => e.id === payload.itemId);
  if (!item) {
    sendMessage(socket, { type: "error", message: "Item not found in equipment." });
    return;
  }
  
  const currentEquipped = actorCombatant.equipped;
  let newEquipped: EquippedItem[] = [...currentEquipped];
  let logMsg = '';
  
  switch (payload.action) {
    case 'draw': {
      const alreadyEquipped = currentEquipped.find(e => e.equipmentId === payload.itemId);
      if (alreadyEquipped?.ready) {
        sendMessage(socket, { type: "error", message: "Item already drawn." });
        return;
      }
      
      const targetSlot: EquipmentSlot = payload.targetSlot ?? (item.type === 'shield' ? 'left_hand' : 'right_hand');
      const slotOccupied = currentEquipped.find(e => e.slot === targetSlot && e.ready);
      if (slotOccupied) {
        sendMessage(socket, { type: "error", message: `${targetSlot} is occupied. Sheathe or drop current item first.` });
        return;
      }
      
      if (alreadyEquipped) {
        newEquipped = newEquipped.map(e => 
          e.equipmentId === payload.itemId ? { ...e, slot: targetSlot, ready: true } : e
        );
      } else {
        newEquipped.push({ equipmentId: payload.itemId, slot: targetSlot, ready: true });
      }
      
      logMsg = `${actorCharacter.name} draws ${item.name}.`;
      break;
    }
    
    case 'sheathe': {
      const equippedItem = currentEquipped.find(e => e.equipmentId === payload.itemId);
      if (!equippedItem || !equippedItem.ready) {
        sendMessage(socket, { type: "error", message: "Item not in hand." });
        return;
      }
      
      const storageSlot: EquipmentSlot = payload.targetSlot ?? 'belt';
      newEquipped = newEquipped.map(e =>
        e.equipmentId === payload.itemId ? { ...e, slot: storageSlot, ready: false } : e
      );
      
      logMsg = `${actorCharacter.name} sheathes ${item.name}.`;
      break;
    }
    
    case 'reload': {
      if (item.type !== 'ranged') {
        sendMessage(socket, { type: "error", message: "Can only reload ranged weapons." });
        return;
      }
      logMsg = `${actorCharacter.name} reloads ${item.name}.`;
      break;
    }
    
    case 'prepare':
    case 'pickup': {
      const targetSlot: EquipmentSlot = payload.targetSlot ?? 'right_hand';
      const slotOccupied = currentEquipped.find(e => e.slot === targetSlot && e.ready);
      if (slotOccupied) {
        sendMessage(socket, { type: "error", message: `${targetSlot} is occupied.` });
        return;
      }
      
      newEquipped = newEquipped.filter(e => e.equipmentId !== payload.itemId);
      newEquipped.push({ equipmentId: payload.itemId, slot: targetSlot, ready: true });
      
      logMsg = payload.action === 'pickup' 
        ? `${actorCharacter.name} picks up ${item.name}.`
        : `${actorCharacter.name} prepares ${item.name}.`;
      break;
    }
  }
  
  const updatedCombatants = match.combatants.map(c =>
    c.playerId === player.id ? { ...c, equipped: newEquipped } : c
  );
  
  const updated = advanceTurn({
    ...match,
    combatants: updatedCombatants,
    log: [...match.log, logMsg],
  });
  
  state.matches.set(matchId, updated);
  await updateMatchState(matchId, updated);
  sendToMatch(matchId, { type: "match_state", state: updated });
  scheduleBotTurn(matchId, updated);
};
