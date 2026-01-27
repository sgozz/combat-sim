import type { CharacterSheet } from "../../../../shared/types";
import type { GurpsCharacterSheet } from "../../../../shared/rulesets/gurps/characterSheet";
import type { CombatantState } from "../../../../shared/rulesets";
import type { EquippedItem } from "../../../../shared/rulesets/gurps/types";
import type { CombatantFactory } from "../types";

export const createCombatant: CombatantFactory = (character, playerId, position, facing) => {
  const gurpsChar = character as GurpsCharacterSheet;
  const equipped: EquippedItem[] = [];
  const primaryWeapon = gurpsChar.equipment.find(e => e.type === 'melee' || e.type === 'ranged');
  const shield = gurpsChar.equipment.find(e => e.type === 'shield');

  if (primaryWeapon) {
    equipped.push({ equipmentId: primaryWeapon.id, slot: 'right_hand', ready: true });
  }
  if (shield) {
    equipped.push({ equipmentId: shield.id, slot: 'left_hand', ready: true });
  }

  return {
    rulesetId: 'gurps' as const,
    playerId,
    characterId: character.id,
    position,
    facing,
    posture: 'standing' as const,
    maneuver: null,
    aoaVariant: null,
    aodVariant: null,
    currentHP: gurpsChar.derived.hitPoints,
    currentFP: gurpsChar.derived.fatiguePoints,
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
