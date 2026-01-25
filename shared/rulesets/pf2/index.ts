import type { Ruleset } from '../Ruleset';
import { pf2UiAdapter } from './ui';
import { calculateDerivedStats } from './rules';
import type { MatchState, CharacterSheet } from '../../types';
import { isPF2Character } from '../../types';
export type {
  PF2Abilities,
  PF2CharacterDerivedStats,
  PF2CharacterWeapon,
  PF2CharacterArmor,
  PF2Feat,
  PF2SpellInfo,
  PF2CharacterSheet,
} from './characterSheet';

export const pf2Ruleset: Ruleset = {
  id: 'pf2',
  getDerivedStats: (character: CharacterSheet) => {
    if (!isPF2Character(character)) {
      throw new Error('Expected PF2 character');
    }
    const stats = calculateDerivedStats(character.abilities, character.level, character.classHP);
    return {
      hitPoints: stats.hitPoints,
      armorClass: stats.armorClass,
      speed: stats.speed,
      fortitudeSave: stats.fortitudeSave,
      reflexSave: stats.reflexSave,
      willSave: stats.willSave,
      perception: stats.perception,
    };
  },
  getInitialCombatantState: (character: CharacterSheet) => ({
    posture: 'standing',
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
