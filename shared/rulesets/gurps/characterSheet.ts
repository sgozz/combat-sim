import type { Id } from '../../types';
import type { Attributes, DerivedStats, Skill, Advantage, Disadvantage, Equipment } from './types';

export type GurpsCharacterSheet = {
  id: Id;
  name: string;
  rulesetId: 'gurps';
  attributes: Attributes;
  derived: DerivedStats;
  skills: Skill[];
  advantages: Advantage[];
  disadvantages: Disadvantage[];
  equipment: Equipment[];
  pointsTotal: number;
};
