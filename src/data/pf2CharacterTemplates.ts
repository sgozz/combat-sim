import type { PF2CharacterSheet } from '../../shared/rulesets/pf2/characterSheet'
import { PF2_TEMPLATES } from '../../shared/rulesets/pf2/templates'

const toRecord = (templates: { id: string; data: Omit<PF2CharacterSheet, 'id'> }[]): Record<string, Omit<PF2CharacterSheet, 'id'>> => {
  const record: Record<string, Omit<PF2CharacterSheet, 'id'>> = {};
  for (const t of templates) {
    record[t.id] = t.data;
  }
  return record;
};

export const PF2_CHARACTER_TEMPLATES: Record<string, Omit<PF2CharacterSheet, 'id'>> =
  toRecord(PF2_TEMPLATES);

export { PF2_TEMPLATE_NAMES, PF2_MONSTER_TEMPLATE_NAMES, PF2_ALL_TEMPLATE_NAMES } from '../../shared/rulesets/pf2/templateNames';
