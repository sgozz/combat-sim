import type { PF2CharacterSheet } from "../../../../shared/rulesets/pf2/characterSheet";
import type { CombatantState, EquippedItem } from "../../../../shared/rulesets/gurps/types";
import type { CombatantFactory } from "../types";

export const createCombatant: CombatantFactory = (character, playerId, position, facing) => {
  const equipped: EquippedItem[] = [];
  const pf2Character = character as PF2CharacterSheet;
  const primaryWeapon = pf2Character.weapons[0];

  if (primaryWeapon) {
    equipped.push({ equipmentId: primaryWeapon.id, slot: "right_hand", ready: true });
  }

  return {
    playerId,
    characterId: character.id,
    position,
    facing,
    posture: "standing" as const,
    maneuver: null,
    aoaVariant: null,
    aodVariant: null,
    currentHP: character.derived.hitPoints,
    currentFP: 0,
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
    attacksRemaining: 3,
    retreatedThisTurn: false,
    defensesThisTurn: 0,
    parryWeaponsUsedThisTurn: [],
    waitTrigger: null,
    pf2: {
      actionsRemaining: 3,
      reactionAvailable: true,
      mapPenalty: 0,
      attacksThisTurn: 0,
      shieldRaised: false,
    },
  };
};
