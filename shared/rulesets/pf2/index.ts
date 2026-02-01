import type { Ruleset } from '../Ruleset';
import { pf2UiAdapter } from './ui';
import { calculateDerivedStats } from './rules';
import type { CharacterSheet } from '../../types';
import { isPF2Character } from '../../types';
import { generateUUID as uuid } from '../../utils/uuid';
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
    getInitialCombatantState: (character: CharacterSheet) => {
      if (!isPF2Character(character)) {
        throw new Error('Expected PF2 character');
      }
      return {
        rulesetId: 'pf2',
        currentHP: character.derived.hitPoints,
        statusEffects: [],
        usedReaction: false,
        actionsRemaining: 3,
        reactionAvailable: true,
        mapPenalty: 0,
        conditions: [],
        tempHP: 0,
        shieldRaised: false,
        heroPoints: 1,
        dying: 0,
        wounded: 0,
        doomed: 0,
        spellSlotUsage: (character.spellcasters ?? []).flatMap((sc, casterIndex) =>
          sc.slots.filter(s => s.level > 0).map(s => ({
            casterIndex,
            level: s.level,
            used: 0,
          }))
        ),
        focusPointsUsed: 0,
      };
    },
   getAvailableActions: () => [],
  getCombatPreview: () => null,
   createCharacter: (name: string): CharacterSheet => ({
     id: uuid(),
     name: name || 'New PF2 Character',
     rulesetId: 'pf2',
     level: 1,
    class: 'Fighter',
    ancestry: 'Human',
    heritage: 'Versatile Heritage',
    background: 'Warrior',
    abilities: {
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    },
    derived: {
      hitPoints: 10,
      armorClass: 10,
      speed: 25,
      fortitudeSave: 0,
      reflexSave: 0,
      willSave: 0,
      perception: 0,
    },
    classHP: 10,
    saveProficiencies: {
      fortitude: 'trained',
      reflex: 'trained',
      will: 'trained',
    },
    perceptionProficiency: 'trained',
    armorProficiency: 'trained',
    skills: [],
    weapons: [],
    armor: null,
    shieldBonus: 0,
    shieldHardness: 0,
    feats: [],
    spells: null,
    spellcasters: [],
   } as CharacterSheet),
};

export const pf2Bundle = {
  ruleset: pf2Ruleset,
  ui: pf2UiAdapter,
};
