import { randomUUID } from "node:crypto";
import type { CharacterSheet } from "../../../../shared/types";
import { getServerAdapter } from "../../../../shared/rulesets/serverAdapter";
import type { CharacterFactory } from "../types";

export const createDefaultCharacter: CharacterFactory = (name) => {
  const adapter = getServerAdapter("gurps");
  const attributes = {
    strength: 10,
    dexterity: 10,
    intelligence: 10,
    health: 10,
  };
  return {
    rulesetId: 'gurps' as const,
    id: randomUUID(),
    name,
    attributes,
    derived: adapter.calculateDerivedStats(attributes),
    skills: [{ id: randomUUID(), name: "Brawling", level: 12 }],
    advantages: [],
    disadvantages: [],
    equipment: [
      {
        id: randomUUID(),
        name: "Club",
        type: "melee",
        damage: "1d+1",
        reach: "1" as const,
        parry: 0,
        skillUsed: "Brawling",
      },
    ],
    pointsTotal: 100,
  };
};
