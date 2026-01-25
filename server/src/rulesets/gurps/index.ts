import { createDefaultCharacter } from './character';
import { createCombatant } from './combatant';
import { executeBotAttack } from './bot';
import type { RulesetServerFactory } from '../types';

export const gurpsServerFactory: RulesetServerFactory = {
  createDefaultCharacter,
  createCombatant,
  executeBotAttack,
};
