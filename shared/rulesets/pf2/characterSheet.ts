import type { Id } from '../../types';
import type { Proficiency, PF2DamageType, PF2Skill, PF2WeaponTrait, SpellCaster } from './types';

// Re-export Abilities as PF2Abilities for clarity
export type { Abilities as PF2Abilities } from './types';

export type PF2CharacterDerivedStats = {
  hitPoints: number;
  armorClass: number;
  speed: number; // in feet
  fortitudeSave: number;
  reflexSave: number;
  willSave: number;
  perception: number;
};

export type PF2CharacterWeapon = {
  id: Id;
  name: string;
  damage: string;          // e.g., "1d8"
  damageType: PF2DamageType;
  proficiencyCategory: 'simple' | 'martial' | 'advanced' | 'unarmed';
  traits: PF2WeaponTrait[];
  potencyRune: number;
  strikingRune: 'striking' | 'greater_striking' | 'major_striking' | null;
  range?: number;
  rangeIncrement?: number;
};

export type PF2CharacterArmor = {
  id: Id;
  name: string;
  proficiencyCategory: 'unarmored' | 'light' | 'medium' | 'heavy';
  acBonus: number;
  dexCap: number | null;
  potencyRune: number;
};

export type PF2Feat = {
  id: Id;
  name: string;
  type: string;
  level: number;
  description?: string;
};

export type PF2SpellInfo = {
  tradition: string;
  proficiency: Proficiency;
  known: string[];
};

export type PF2CharacterSheet = {
   id: Id;
   name: string;
   rulesetId: 'pf2';
   level: number;
   class: string;
   ancestry: string;
   heritage: string;
   background: string;
   
   // Abilities (NOT attributes.health - use abilities.constitution)
   abilities: {
     strength: number;
     dexterity: number;
     constitution: number;
     intelligence: number;
     wisdom: number;
     charisma: number;
   };
   
   derived: PF2CharacterDerivedStats;
   
   // Data for derived stats recalculation
   classHP: number;
   saveProficiencies: {
     fortitude: Proficiency;
     reflex: Proficiency;
     will: Proficiency;
   };
   perceptionProficiency: Proficiency;
   armorProficiency: Proficiency;
   
   // Equipment and features
   skills: PF2Skill[];
   weapons: PF2CharacterWeapon[];
   armor: PF2CharacterArmor | null;
   shieldBonus: number;
   shieldHardness: number;
   feats: PF2Feat[];
   spells: PF2SpellInfo | null;
   spellcasters: SpellCaster[];
   isFavorite?: boolean;
   
   // Pathbuilder sync metadata
   pathbuilderId?: string;
   lastSyncedAt?: number;
};
