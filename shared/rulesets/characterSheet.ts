import type { PF2CharacterSheet } from './pf2/characterSheet';
import type { GurpsCharacterSheet } from './gurps/characterSheet';

/**
 * Union type representing a character sheet from any supported ruleset.
 * Use type guards `isPF2Character` and `isGurpsCharacter` to discriminate.
 */
export type CharacterSheet = PF2CharacterSheet | GurpsCharacterSheet;

/**
 * Type guard to discriminate PF2 characters.
 * Resilient: checks field existence, null safety, and type before accessing nested properties.
 * Returns false on malformed input instead of throwing.
 * Accepts unknown for ergonomic usage with external data sources.
 */
export function isPF2Character(character: unknown): character is PF2CharacterSheet {
  return (
    typeof character === 'object' &&
    character !== null &&
    'abilities' in character &&
    character.abilities !== null &&
    typeof character.abilities === 'object' &&
    'constitution' in character.abilities
  );
}

/**
 * Type guard to discriminate GURPS characters.
 * Resilient: checks field existence, null safety, and type before accessing nested properties.
 * Returns false on malformed input instead of throwing.
 * Accepts unknown for ergonomic usage with external data sources.
 */
export function isGurpsCharacter(character: unknown): character is GurpsCharacterSheet {
  return (
    typeof character === 'object' &&
    character !== null &&
    'attributes' in character &&
    character.attributes !== null &&
    typeof character.attributes === 'object' &&
    'health' in character.attributes
  );
}
