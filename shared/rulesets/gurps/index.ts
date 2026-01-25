import type { Ruleset } from '../Ruleset';
import { gurpsUiAdapter } from './ui';
import { calculateDerivedStats } from './rules';
import type { MatchState, CharacterSheet } from '../../types';
import { isGurpsCharacter } from '../../types';
import { uuid } from '../../utils/uuid';

export const gurpsRuleset: Ruleset = {
  id: 'gurps',
  getDerivedStats: (character: CharacterSheet) => {
    if (!isGurpsCharacter(character)) {
      throw new Error('Expected GURPS character');
    }
    return calculateDerivedStats(character.attributes);
  },
  getInitialCombatantState: (character: CharacterSheet) => {
    if (!isGurpsCharacter(character)) {
      throw new Error('Expected GURPS character');
    }
    return {
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
      attacksRemaining: 1,
      retreatedThisTurn: false,
      defensesThisTurn: 0,
      parryWeaponsUsedThisTurn: [],
      waitTrigger: null,
    };
  },
  getAvailableActions: (_state: MatchState) => [],
  getCombatPreview: () => null,
  createCharacter: (name: string): CharacterSheet => ({
    id: uuid(),
    name: name || 'New Character',
    attributes: {
      strength: 10,
      dexterity: 10,
      intelligence: 10,
      health: 10,
    },
    derived: {
      hitPoints: 10,
      fatiguePoints: 10,
      basicSpeed: 5,
      basicMove: 5,
      dodge: 8,
    },
    skills: [],
    advantages: [],
    disadvantages: [],
    equipment: [],
    pointsTotal: 100,
  } as any),
};

export const gurpsBundle = {
  ruleset: gurpsRuleset,
  ui: gurpsUiAdapter,
};

export type { GurpsCharacterSheet } from './characterSheet';
