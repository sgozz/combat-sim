import type { PF2CharacterSheet } from "../../../../shared/rulesets/pf2/characterSheet";
import type { EquippedItem } from "../../../../shared/rulesets/gurps/types";
import type { CombatantFactory } from "../types";

export const createCombatant: CombatantFactory = (character, playerId, position, facing) => {
  const equipped: EquippedItem[] = [];
  const pf2Character = character as PF2CharacterSheet;
  const primaryWeapon = pf2Character.weapons?.[0];

  if (primaryWeapon) {
    equipped.push({ equipmentId: primaryWeapon.id, slot: "right_hand", ready: true });
  }

  return {
    rulesetId: 'pf2' as const,
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
    usedReaction: false,
    equipped,
    waitTrigger: null,
    actionsRemaining: 3,
    reactionAvailable: true,
    mapPenalty: 0,
    conditions: [],
    tempHP: 0,
    shieldRaised: false,
    heroPoints: 1,
    dying: 0,
    wounded: 0,
    doomed: 0,
    spellSlotUsage: [],
    focusPointsUsed: 0,
  };
};
