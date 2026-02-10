import { promises as fs } from 'fs';
import * as path from 'path';

const FOUNDRY_REPO = 'foundryvtt/pf2e';
const FOUNDRY_BRANCH = 'master';
const SPELLS_PATH = 'packs/pf2e/spells';
const CACHE_DIR = 'data/cache';
const CACHE_FILE = 'foundry-spells.json';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type FoundrySpellRaw = {
  name: string;
  type: string;
  system: {
    area?: { type: string; value: number } | null;
    damage?: Record<string, { formula: string; type: string; kinds?: string[] }>;
    defense?: { save?: { basic: boolean; statistic: string } } | null;
    heightening?: {
      type: 'interval' | 'fixed';
      interval?: number;
      damage?: Record<string, string>;
      levels?: Record<string, { damage?: Record<string, { formula: string; type?: string }> }>;
    } | null;
    level: { value: number };
    range: { value: string } | null;
    time: { value: string };
    traits: {
      traditions?: string[];
      value: string[];
    };
    duration: { sustained: boolean; value: string };
    target: { value: string } | null;
    description: { value: string };
  };
};

async function tryReadCache(filePath: string): Promise<FoundrySpellRaw[] | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as FoundrySpellRaw[];
  } catch {
    return null;
  }
}

async function isCacheFresh(filePath: string): Promise<boolean> {
  try {
    const stats = await fs.stat(filePath);
    const age = Date.now() - stats.mtime.getTime();
    return age < CACHE_TTL_MS;
  } catch {
    return false;
  }
}

async function writeCache(filePath: string, data: FoundrySpellRaw[]): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data));
}

type GitTreeEntry = {
  path: string;
  type: string;
  sha: string;
  url: string;
};

type GitTreeResponse = {
  tree: GitTreeEntry[];
  truncated: boolean;
};

async function fetchGitTree(treePath: string): Promise<GitTreeEntry[]> {
  const url = `https://api.github.com/repos/${FOUNDRY_REPO}/git/trees/${FOUNDRY_BRANCH}?recursive=1`;
  const response = await fetch(url, {
    headers: { 'Accept': 'application/vnd.github.v3+json' },
  });

  if (!response.ok) {
    throw new Error(`GitHub tree API returned ${response.status}: ${response.statusText}`);
  }

  const data = await response.json() as GitTreeResponse;

  return data.tree.filter(
    entry => entry.type === 'blob' && entry.path.startsWith(treePath) && entry.path.endsWith('.json')
  );
}

async function fetchRawFile(filePath: string): Promise<FoundrySpellRaw> {
  const url = `https://raw.githubusercontent.com/${FOUNDRY_REPO}/${FOUNDRY_BRANCH}/${filePath}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`GitHub raw fetch returned ${response.status} for ${filePath}`);
  }

  return await response.json() as FoundrySpellRaw;
}

const BATCH_SIZE = 20;
const BATCH_DELAY_MS = 200;

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function fetchFoundrySpells(): Promise<FoundrySpellRaw[]> {
  const cacheFile = path.join(CACHE_DIR, CACHE_FILE);
  const cachedData = await tryReadCache(cacheFile);

  if (cachedData && await isCacheFresh(cacheFile)) {
    console.log(`[foundry-spells] Using cached data (${cachedData.length} spells)`);
    return cachedData;
  }

  try {
    console.log('[foundry-spells] Fetching spell list from GitHub...');
    const spellEntries = await fetchGitTree(SPELLS_PATH);
    console.log(`[foundry-spells] Found ${spellEntries.length} spell files`);

    const spells: FoundrySpellRaw[] = [];
    const errors: string[] = [];

    for (let i = 0; i < spellEntries.length; i += BATCH_SIZE) {
      const batch = spellEntries.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(entry => fetchRawFile(entry.path))
      );

      for (let j = 0; j < results.length; j++) {
        const result = results[j];
        if (result.status === 'fulfilled' && result.value.type === 'spell') {
          spells.push(result.value);
        } else if (result.status === 'rejected') {
          errors.push(`${batch[j].path}: ${result.reason}`);
        }
      }

      if (i + BATCH_SIZE < spellEntries.length) {
        await sleep(BATCH_DELAY_MS);
      }
    }

    if (errors.length > 0) {
      console.warn(`[foundry-spells] ${errors.length} fetch errors (${spells.length} succeeded)`);
    }

    console.log(`[foundry-spells] Fetched ${spells.length} spells, caching...`);
    await writeCache(cacheFile, spells);
    return spells;
  } catch (error) {
    if (cachedData) {
      console.warn(`[foundry-spells] Fetch failed, using stale cache: ${error}`);
      return cachedData;
    }
    console.error(`[foundry-spells] Spell data unavailable: ${error}`);
    return [];
  }
}
