import { fetchFoundrySpells } from './foundrySpellFetcher';
import { parseFoundrySpells } from '../../../shared/rulesets/pf2/foundrySpellParser';
import type { FoundrySpellData } from '../../../shared/rulesets/pf2/foundrySpellParser';
import { enrichSpellDatabase, getSpellCount } from '../../../shared/rulesets/pf2/spellData';

export async function loadFoundrySpellData(): Promise<void> {
  const before = getSpellCount();
  console.log(`[spell-loader] Starting with ${before} hardcoded spells`);

  const rawSpells = await fetchFoundrySpells();
  if (rawSpells.length === 0) {
    console.warn('[spell-loader] No Foundry spells fetched, using hardcoded only');
    return;
  }

  const parsed = parseFoundrySpells(rawSpells as unknown as FoundrySpellData[]);
  const added = enrichSpellDatabase(parsed);
  const after = getSpellCount();

  console.log(`[spell-loader] Added ${added} Foundry spells (${after} total)`);
}
