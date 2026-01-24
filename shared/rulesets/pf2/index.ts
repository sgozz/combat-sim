import type { Ruleset } from '../Ruleset';
import { pf2UiAdapter } from './ui';
import { calculateDerivedStats } from './rules';
import type { MatchState, CharacterSheet } from '../../types';
import type { Abilities } from './types';

export const pf2Ruleset: Ruleset = {
  id: 'pf2',
  getDerivedStats: (attributes) => {
    const abilities: Abilities = {
      strength: attributes.strength,
      dexterity: attributes.dexterity,
      constitution: attributes.health,
      intelligence: attributes.intelligence,
      wisdom: attributes.wisdom ?? 10,
      charisma: attributes.charisma ?? 10,
    };
    const stats = calculateDerivedStats(abilities, 1, 8);
    return {
      hitPoints: stats.hitPoints,
      fatiguePoints: 0,
      basicSpeed: stats.speed / 5,
      basicMove: Math.floor(stats.speed / 5),
      dodge: stats.armorClass,
    };
  },
  getInitialCombatantState: (character: CharacterSheet) => ({
    posture: 'standing',
    maneuver: null,
    aoaVariant: null,
    aodVariant: null,
    currentHP: character.derived.hitPoints,
    currentFP: character.derived.fatiguePoints,
    statusEffects: [],
    aimTurns: 0,
    aimTargetId: null,
    evaluateBonus: 0,
    evaluateTargetId: null,
    equipped: [],
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
  }),
  getAvailableActions: (_state: MatchState) => [],
  getCombatPreview: () => null,
};

export const pf2Bundle = {
  ruleset: pf2Ruleset,
  ui: pf2UiAdapter,
};
