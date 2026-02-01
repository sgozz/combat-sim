import type { PF2CharacterSheet } from '../../shared/rulesets/pf2/characterSheet';
import { validatePathbuilderExport } from '../../shared/rulesets/pf2/pathbuilder';
import { mapPathbuilderToCharacter, collectWarnings } from '../../shared/rulesets/pf2/pathbuilderMapping';

export type PathbuilderResult =
  | { success: true; character: PF2CharacterSheet; warnings: string[] }
  | { success: false; error: string };

export const fetchFromAPI = async (characterId: string): Promise<PathbuilderResult> => {
  try {
    const response = await fetch(`https://pathbuilder2e.com/json.php?id=${characterId}`);
    const data = await response.json();
    const validated = validatePathbuilderExport(data);
    if (!validated) return { success: false, error: 'Invalid Pathbuilder response format' };
    const warnings = collectWarnings(validated.build);
    const character = mapPathbuilderToCharacter(validated, characterId);
    return { success: true, character, warnings };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unknown error' };
  }
};

export const parseFromFile = async (file: File): Promise<PathbuilderResult> => {
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    const validated = validatePathbuilderExport(data);
    if (!validated) return { success: false, error: 'Invalid Pathbuilder JSON format' };
    const warnings = collectWarnings(validated.build);
    const character = mapPathbuilderToCharacter(validated);
    return { success: true, character, warnings };
  } catch (e) {
    if (e instanceof SyntaxError) {
      return { success: false, error: 'Invalid JSON file' };
    }
    return { success: false, error: e instanceof Error ? e.message : 'Invalid JSON file' };
  }
};
