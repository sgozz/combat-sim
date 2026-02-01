import { loadFeatsFromPf2ools } from './pf2oolsParser';
import type { PF2FeatDefinition } from './pf2oolsParser';

let cachedDatabase: Map<string, PF2FeatDefinition> | null = null;

export function initializeFeatDatabase(pf2oolsData: unknown[]): Map<string, PF2FeatDefinition> {
  cachedDatabase = loadFeatsFromPf2ools(pf2oolsData);
  return cachedDatabase;
}

export function getFeatDatabase(): Map<string, PF2FeatDefinition> {
  if (!cachedDatabase) {
    cachedDatabase = new Map();
  }
  return cachedDatabase;
}

export function getFeat(name: string): PF2FeatDefinition | undefined {
  return getFeatDatabase().get(name);
}

export const FEAT_DATABASE = getFeatDatabase();
