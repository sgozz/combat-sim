import type { Id } from '../../types';
import type { BaseCombatantState } from '../base/types';

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
  | { type: 'end_turn' };

export type PF2CombatActionPayload =
  | { type: 'pf2_stand' }
  | { type: 'pf2_drop_prone' };

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
