import type { CharacterSheet } from "../../../../shared/types";
import type { CombatantState, EquippedItem } from "../../../../shared/rulesets/gurps/types";
import type { CombatantFactory } from "../types";

export const createCombatant: CombatantFactory = (character, playerId, position, facing) => {
  const equipped: EquippedItem[] = [];
  const primaryWeapon = character.equipment.find(e => e.type === 'melee' || e.type === 'ranged');
  const shield = character.equipment.find(e => e.type === 'shield');

  if (primaryWeapon) {
    equipped.push({ equipmentId: primaryWeapon.id, slot: 'right_hand', ready: true });
  }
  if (shield) {
    equipped.push({ equipmentId: shield.id, slot: 'left_hand', ready: true });
  }

  return {
    playerId,
    characterId: character.id,
    position,
    facing,
    posture: 'standing' as const,
    maneuver: null,
    aoaVariant: null,
    aodVariant: null,
    currentHP: character.derived.hitPoints,
    currentFP: character.derived.fatiguePoints,
    statusEffects: [],
    aimTurns: 0,
    aimTargetId: null,
    evaluateBonus: 0,
    evaluateTargetId: null,
    equipped,
    inCloseCombatWith: null,
    closeCombatPosition: null,
    grapple: { grappledBy: null, grappling: null, cpSpent: 0, cpReceived: 0 },
    usedReaction: false,
    shockPenalty: 0,
    attacksRemaining: 1,
    retreatedThisTurn: false,
    defensesThisTurn: 0,
    parryWeaponsUsedThisTurn: [],
    waitTrigger: null,
  };
};
