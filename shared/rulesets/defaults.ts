import type { RulesetId } from '../types'

/**
 * Asserts that a ruleset ID is defined, throwing if undefined.
 * Use this when a ruleset ID is required and undefined is a programming error.
 * 
 * @param id - The ruleset ID to check
 * @returns The ruleset ID (for chaining)
 * @throws Error if id is undefined
 */
export function assertRulesetId(id: RulesetId | undefined): RulesetId {
  if (id === undefined) {
    throw new Error('Ruleset ID is required but was undefined')
  }
  return id
}

/**
 * Gets a ruleset ID or throws with context about where it was needed.
 * Use this when a ruleset ID is required and you want a descriptive error.
 * 
 * @param id - The ruleset ID to check
 * @param context - Description of where the ID was needed (for error message)
 * @returns The ruleset ID (for chaining)
 * @throws Error if id is undefined, with context in message
 */
export function getRulesetIdOrThrow(
  id: RulesetId | undefined,
  context: string
): RulesetId {
  if (id === undefined) {
    throw new Error(`Ruleset ID is required for ${context}`)
  }
  return id
}
