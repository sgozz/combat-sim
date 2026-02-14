import type { CharacterSheet, RulesetId } from '../types';
import { GURPS_TEMPLATES } from './gurps/templates';
import { PF2_TEMPLATES } from './pf2/templates';

export type TemplateCategory = 'hero' | 'monster';

export type TemplateEntry<T = CharacterSheet> = {
  id: string;
  label: string;
  category: TemplateCategory;
  data: Omit<T, 'id'>;
};

export const getTemplatesForRuleset = (rulesetId: RulesetId): TemplateEntry<CharacterSheet>[] => {
  if (rulesetId === 'pf2') {
    return PF2_TEMPLATES as TemplateEntry<CharacterSheet>[];
  }
  return GURPS_TEMPLATES as TemplateEntry<CharacterSheet>[];
};

export const getTemplateById = (rulesetId: RulesetId, templateId: string): TemplateEntry<CharacterSheet> | undefined => {
  const templates = getTemplatesForRuleset(rulesetId);
  return templates.find(t => t.id === templateId);
};

export const getMonsterTemplates = (rulesetId: RulesetId): TemplateEntry<CharacterSheet>[] => {
  return getTemplatesForRuleset(rulesetId).filter(t => t.category === 'monster');
};

export const getHeroTemplates = (rulesetId: RulesetId): TemplateEntry<CharacterSheet>[] => {
  return getTemplatesForRuleset(rulesetId).filter(t => t.category === 'hero');
};
