import { randomUUID } from "node:crypto";
import type { PF2CharacterSheet } from "../../../../shared/rulesets/pf2/characterSheet";

export const createDefaultCharacter = (name: string = "PF2 Character"): PF2CharacterSheet => ({
  rulesetId: 'pf2' as const,
  id: randomUUID(),
  name,
  level: 1,
  class: "Fighter",
  ancestry: "Human",
  heritage: "Versatile Heritage",
  background: "Warrior",

  // Core stats - Fighter level 1 with 14 CON
  abilities: {
    strength: 14,
    dexterity: 12,
    constitution: 14,
    intelligence: 10,
    wisdom: 10,
    charisma: 10,
  },

  // Derived stats (reasonable defaults for level 1 Fighter)
  derived: {
    hitPoints: 20, // Level 1 Fighter, 14 CON
    armorClass: 14, // Unarmored: 10 + DEX(1) + level(1) + trained(2)
    speed: 25, // Standard human speed
    fortitudeSave: 5, // Simplified
    reflexSave: 3, // Simplified
    willSave: 1, // Simplified
    perception: 3, // Simplified
  },

  // Fields required for derived stats recalculation
  classHP: 10, // Fighter class HP per level
  saveProficiencies: {
    fortitude: "expert", // Fighter is expert in Fortitude
    reflex: "trained",
    will: "trained",
  },
  perceptionProficiency: "expert", // Fighter is expert in Perception
  armorProficiency: "trained", // Unarmored is trained

  // Equipment and features
  skills: [],
  weapons: [
    {
      id: randomUUID(),
      name: "Longsword",
      damage: "1d8",
      damageType: "slashing",
      proficiencyCategory: "martial",
      traits: [],
      potencyRune: 0,
      strikingRune: null,
    },
  ],
  armor: null,
  feats: [],
  spells: null,
  shieldBonus: 0,
  spellcasters: [],
});
