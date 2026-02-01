import type { PF2CharacterSheet } from './characterSheet';

/**
 * Feat effect configuration.
 * Defines how a feat affects gameplay mechanics.
 */
export interface PF2FeatEffect {
  type: 'reaction' | 'action' | 'modifier';
  handler: string;  // Name of handler function
  description?: string;
}

/**
 * Registry of feat effects.
 * Maps feat names to their mechanical effects.
 * 
 * Pattern follows conditions.ts modifier approach:
 * - Pure data structure (no execution logic)
 * - Handler names reference implementation functions
 * - Extensible for future feats
 */
export const FEAT_EFFECTS = new Map<string, PF2FeatEffect>([
  ['Attack of Opportunity', {
    type: 'reaction',
    handler: 'handleAoO',
    description: 'Make a melee Strike against a creature that leaves a square within your reach'
  }],
  ['Shield Block', {
    type: 'reaction',
    handler: 'handleShieldBlock',
    description: 'Reduce damage from a physical attack by your shield\'s Hardness'
  }],
  ['Power Attack', {
    type: 'action',
    handler: 'handlePowerAttack',
    description: 'Make a melee Strike that counts as two attacks for your multiple attack penalty'
  }],
  ['Sudden Charge', {
    type: 'action',
    handler: 'handleSuddenCharge',
    description: 'Stride twice and make a melee Strike'
  }],
  ['Intimidating Strike', {
    type: 'action',
    handler: 'handleIntimidatingStrike',
    description: 'Make a Strike and apply frightened on hit'
  }],
  ['Reactive Shield', {
    type: 'reaction',
    handler: 'handleReactiveShield',
    description: 'Raise your shield when hit by an attack'
  }],
  ['Nimble Dodge', {
    type: 'reaction',
    handler: 'handleNimbleDodge',
    description: 'Gain +2 circumstance bonus to AC against one attack'
  }],
  ['Quick Draw', {
    type: 'action',
    handler: 'handleQuickDraw',
    description: 'Interact to draw a weapon and then Strike with it'
  }],
  ['Point-Blank Shot', {
    type: 'modifier',
    handler: 'handlePointBlankShot',
    description: 'Reduce the ranged penalty for attacking within melee reach'
  }],
]);

/**
 * Check if a character has a specific feat.
 * 
 * @param character - PF2 character sheet
 * @param featName - Exact feat name (case-sensitive)
 * @returns true if character has the feat
 * 
 * @example
 * ```typescript
 * if (hasFeat(character, 'Attack of Opportunity')) {
 *   // Character can make AoO reactions
 * }
 * ```
 */
export function hasFeat(character: PF2CharacterSheet, featName: string): boolean {
  return character.feats.some(f => f.name === featName);
}

/**
 * Get the effect configuration for a feat.
 * 
 * @param featName - Exact feat name
 * @returns Feat effect config or undefined if not registered
 * 
 * @example
 * ```typescript
 * const effect = getFeatEffect('Attack of Opportunity');
 * if (effect?.type === 'reaction') {
 *   // Handle reaction feat
 * }
 * ```
 */
export function getFeatEffect(featName: string): PF2FeatEffect | undefined {
  return FEAT_EFFECTS.get(featName);
}
