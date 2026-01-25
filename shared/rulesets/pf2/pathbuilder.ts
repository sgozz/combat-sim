/**
 * Pathbuilder 2e JSON export types and validation
 * https://pathbuilder2e.com/
 */

/**
 * Ability scores object from Pathbuilder export
 */
export interface PathbuilderAbilities {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
  breakdown?: {
    ancestryFree?: string[];
    ancestryBoosts?: string[];
    ancestryFlaws?: string[];
    backgroundBoosts?: string[];
    classBoosts?: string[];
    mapLevelledBoosts?: Record<string, string[]>;
  };
}

/**
 * Proficiencies object from Pathbuilder export
 * Maps proficiency names to proficiency levels (0-4: untrained, trained, expert, master, legendary)
 */
export interface PathbuilderProficiencies {
  classDC?: number;
  perception?: number;
  fortitude?: number;
  reflex?: number;
  will?: number;
  [key: string]: number | undefined;
}

/**
 * Character build from Pathbuilder export
 */
export interface PathbuilderBuild {
  name: string;
  class: string;
  dualClass?: string | null;
  level: number;
  ancestry: string;
  heritage?: string;
  background?: string;
  alignment?: string;
  gender?: string;
  age?: string;
  deity?: string;
  size?: number;
  sizeName?: string;
  keyability?: string;
  languages?: string[];
  rituals?: unknown[];
  resistances?: unknown[];
  inventorMods?: unknown[];
  attributes?: {
    ancestryhp?: number;
    classhp?: number;
    bonushp?: number;
    bonushpPerLevel?: number;
    speed?: number;
    speedBonus?: number;
  };
  abilities: PathbuilderAbilities;
  proficiencies: PathbuilderProficiencies;
  mods?: Record<string, unknown>;
  feats?: unknown[];
  specials?: string[];
  lores?: unknown[];
  equipmentContainers?: Record<string, unknown>;
  equipment?: unknown[];
}

/**
 * Top-level Pathbuilder export response
 */
export interface PathbuilderExport {
  success: true;
  build: PathbuilderBuild;
}

/**
 * Validates a Pathbuilder export JSON object
 * Returns the typed object if valid, null if invalid
 *
 * Validation checks:
 * - success === true
 * - build.name is non-empty string
 * - build.level is 1-20
 * - build.abilities has all 6 ability scores (str, dex, con, int, wis, cha)
 * - build.proficiencies object exists
 */
export function validatePathbuilderExport(data: unknown): PathbuilderExport | null {
  // Check if data is an object
  if (typeof data !== 'object' || data === null) {
    return null;
  }

  const obj = data as Record<string, unknown>;

  // Check success === true
  if (obj.success !== true) {
    return null;
  }

  // Check build exists and is an object
  if (typeof obj.build !== 'object' || obj.build === null) {
    return null;
  }

  const build = obj.build as Record<string, unknown>;

  // Check build.name is non-empty string
  if (typeof build.name !== 'string' || build.name.trim().length === 0) {
    return null;
  }

  // Check build.level is 1-20
  if (typeof build.level !== 'number' || build.level < 1 || build.level > 20) {
    return null;
  }

  // Check build.abilities exists and has all 6 ability scores
  if (typeof build.abilities !== 'object' || build.abilities === null) {
    return null;
  }

  const abilities = build.abilities as Record<string, unknown>;
  const requiredAbilities = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
  for (const ability of requiredAbilities) {
    if (typeof abilities[ability] !== 'number') {
      return null;
    }
  }

  // Check build.proficiencies exists
  if (typeof build.proficiencies !== 'object' || build.proficiencies === null) {
    return null;
  }

  // All checks passed - return typed object
  return data as PathbuilderExport;
}
