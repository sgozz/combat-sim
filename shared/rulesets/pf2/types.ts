import type { Id } from '../../types';
import type { BaseCombatantState } from '../base/types';
import type { EquippedItem } from '../gurps/types';

export type Abilities = {
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
};

export type AbilityModifier = -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type PF2DerivedStats = {
  hitPoints: number;
  armorClass: number;
  fortitudeSave: number;
  reflexSave: number;
  willSave: number;
  perception: number;
  speed: number;
};

export type Proficiency = 'untrained' | 'trained' | 'expert' | 'master' | 'legendary';

export type PF2Skill = {
  id: Id;
  name: string;
  ability: keyof Abilities;
  proficiency: Proficiency;
};

export type ActionCost = 1 | 2 | 3 | 'free' | 'reaction';

export type DegreeOfSuccess = 'critical_failure' | 'failure' | 'success' | 'critical_success';

export type PF2DamageType = 
  | 'bludgeoning' | 'piercing' | 'slashing'
  | 'fire' | 'cold' | 'electricity' | 'acid' | 'sonic'
  | 'positive' | 'negative' | 'force'
  | 'mental' | 'poison';

export type PF2Condition =
  | 'blinded'
  | 'clumsy'
  | 'confused'
  | 'dazzled'
  | 'deafened'
  | 'doomed'
  | 'drained'
  | 'dying'
  | 'encumbered'
  | 'enfeebled'
  | 'fascinated'
  | 'fatigued'
  | 'flat_footed'
  | 'fleeing'
  | 'frightened'
  | 'grabbed'
  | 'hidden'
  | 'immobilized'
  | 'observed'
  | 'paralyzed'
  | 'persistent_damage'
  | 'petrified'
  | 'prone'
  | 'quickened'
  | 'restrained'
  | 'sickened'
  | 'slowed'
  | 'stunned'
  | 'stupefied'
  | 'unconscious'
  | 'undetected'
  | 'wounded';

export type ConditionValue = {
  condition: PF2Condition;
  value?: number;
};

export type PF2WeaponTrait =
  | 'agile'
  | 'backstabber'
  | 'deadly'
  | 'disarm'
  | 'fatal'
  | 'finesse'
  | 'forceful'
  | 'free_hand'
  | 'grapple'
  | 'jousting'
  | 'parry'
  | 'reach'
  | 'shove'
  | 'sweep'
  | 'thrown'
  | 'trip'
  | 'twin'
  | 'two_hand'
  | 'unarmed'
  | 'versatile';

export type PF2Weapon = {
  id: Id;
  name: string;
  damage: string;
  damageType: PF2DamageType;
  traits: PF2WeaponTrait[];
  range?: number;
  hands: 1 | 2;
  group: string;
  proficiency: Proficiency;
};

export type PF2Armor = {
  id: Id;
  name: string;
  acBonus: number;
  dexCap: number | null;
  checkPenalty: number;
  speedPenalty: number;
  strength: number;
  proficiency: Proficiency;
};

export type PF2ActionType =
  | 'strike'
  | 'stride'
  | 'step'
  | 'interact'
  | 'release'
  | 'raise_shield'
  | 'take_cover'
  | 'drop_prone'
  | 'crawl'
  | 'stand'
  | 'leap'
  | 'ready'
  | 'delay'
  | 'aid'
  | 'seek'
  | 'point_out'
  | 'escape'
  | 'grapple'
  | 'shove'
  | 'trip'
  | 'disarm'
  | 'feint'
  | 'tumble_through'
  | 'demoralize';

export type PF2CombatAction = {
  type: PF2ActionType;
  cost: ActionCost;
  targetId?: Id;
  weaponId?: Id;
};

export type PF2CombatantState = BaseCombatantState & {
  rulesetId: 'pf2';
  actionsRemaining: number;
  reactionAvailable: boolean;
  mapPenalty: number;
  conditions: ConditionValue[];
  statusEffects: string[];
  tempHP: number;
  shieldRaised: boolean;
  shieldHP?: number;
  heroPoints: number;
  dying: number;
  wounded: number;
  doomed: number;
  spellSlotUsage: SpellSlotUsage[];
  focusPointsUsed: number;
  equipped: EquippedItem[];
};

export type PF2ActionPayload =
  | { type: 'strike'; targetId: Id; weaponId?: Id }
  | { type: 'stride'; to: { q: number; r: number } }
  | { type: 'step'; to: { q: number; r: number } }
  | { type: 'raise_shield' }
  | { type: 'take_cover' }
  | { type: 'drop_prone' }
  | { type: 'stand' }
  | { type: 'crawl'; to: { q: number; r: number } }
  | { type: 'ready'; action: PF2ActionType; trigger: string }
  | { type: 'delay' }
  | { type: 'escape' }
  | { type: 'grapple'; targetId: Id }
  | { type: 'shove'; targetId: Id }
  | { type: 'trip'; targetId: Id }
  | { type: 'disarm'; targetId: Id }
  | { type: 'feint'; targetId: Id }
  | { type: 'demoralize'; targetId: Id }
  | { type: 'cast_spell'; casterIndex: number; spellName: string; spellLevel: number; targetId?: Id }
  | { type: 'end_turn' };

export type PF2CombatActionPayload =
  | { type: 'pf2_stand' }
  | { type: 'pf2_drop_prone' }
  | { type: 'pf2_raise_shield' }
  | { type: 'pf2_request_move'; mode: 'stride' }
  | { type: 'pf2_stride'; to: { q: number; r: number } }
  | { type: 'pf2_reaction_choice'; choice: 'aoo' | 'decline' }
  | { type: 'pf2_grapple'; targetId: string }
  | { type: 'pf2_trip'; targetId: string }
  | { type: 'pf2_disarm'; targetId: string }
  | { type: 'pf2_feint'; targetId: string }
  | { type: 'pf2_demoralize'; targetId: string };

// --- Spell Casting Types ---

export type SpellSlot = {
  level: number;
  total: number;
  used: number;
};

export type FocusPool = {
  max: number;
  current: number;
};

export type SpellCaster = {
  name: string;
  tradition: string;
  type: string; // 'prepared' | 'spontaneous'
  proficiency: number; // raw proficiency rank (0,2,4,6,8)
  slots: SpellSlot[];
  focusPool: FocusPool;
  knownSpells: { level: number; spells: string[] }[];
};

export type SpellSlotUsage = {
  casterIndex: number;
  level: number;
  used: number;
};

export type PF2DefenseType = 'ac' | 'fortitude' | 'reflex' | 'will';

export type PF2PendingDefense = {
  attackerId: Id;
  defenderId: Id;
  attackRoll: number;
  dc: number;
  degree: DegreeOfSuccess;
  damage?: string;
  damageType?: PF2DamageType;
  criticalSpecialization?: string;
};

// --- Spell Definition Types ---

export type SpellDefinition = {
  name: string;
  level: number;
  tradition: string;
  castActions: 1 | 2 | 3;
  targetType: 'single' | 'area' | 'self';
  save?: 'fortitude' | 'reflex' | 'will';
  damageFormula?: string;
  damageType?: PF2DamageType;
  healFormula?: string;
  conditions?: ConditionValue[];
  duration?: string;
};
