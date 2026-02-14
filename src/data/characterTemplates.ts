import type { GurpsCharacterSheet } from '../../shared/rulesets/gurps/characterSheet'
import type { CharacterSheet, RulesetId } from '../../shared/types'
import { GURPS_TEMPLATES } from '../../shared/rulesets/gurps/templates'


export { TEMPLATE_NAMES, MONSTER_TEMPLATE_NAMES, ALL_TEMPLATE_NAMES } from '../../shared/rulesets/gurps/templateNames'
export { getTemplatesForRuleset, getTemplateById, getMonsterTemplates, getHeroTemplates } from '../../shared/rulesets/templates'
export type { TemplateEntry, TemplateCategory } from '../../shared/rulesets/templates'

const toRecord = <T extends CharacterSheet>(templates: { id: string; data: Omit<T, 'id'> }[]): Record<string, Omit<T, 'id'>> => {
  const record: Record<string, Omit<T, 'id'>> = {};
  for (const t of templates) {
    record[t.id] = t.data;
  }
  return record;
};

export const CHARACTER_TEMPLATES: Record<string, Omit<GurpsCharacterSheet, 'id'>> =
  toRecord<GurpsCharacterSheet>(GURPS_TEMPLATES);

import { PF2_CHARACTER_TEMPLATES, PF2_TEMPLATE_NAMES } from './pf2CharacterTemplates'
export { PF2_CHARACTER_TEMPLATES, PF2_TEMPLATE_NAMES }

export const getTemplateRecordForRuleset = (rulesetId: RulesetId): Record<string, Omit<CharacterSheet, 'id'>> => {
  if (rulesetId === 'pf2') {
    return PF2_CHARACTER_TEMPLATES as Record<string, Omit<CharacterSheet, 'id'>>
  }
  return CHARACTER_TEMPLATES as Record<string, Omit<CharacterSheet, 'id'>>
}
