import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { fetchFoundrySpells } from './foundrySpellFetcher';
import type { FoundrySpellRaw } from './foundrySpellFetcher';
import path from 'path';

const CACHE_DIR = 'data/cache';
const CACHE_FILE = path.join(CACHE_DIR, 'foundry-spells.json');

function makeRawSpell(name: string, level: number): FoundrySpellRaw {
  return {
    name,
    type: 'spell',
    system: {
      level: { value: level },
      time: { value: '2' },
      traits: { traditions: ['arcane'], value: [] },
      duration: { sustained: false, value: '' },
      target: null,
      range: null,
      description: { value: '' },
    },
  };
}

describe('fetchFoundrySpells', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    try {
      await fs.rm(CACHE_DIR, { recursive: true, force: true });
    } catch { /* empty */ }
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(async () => {
    try {
      await fs.rm(CACHE_DIR, { recursive: true, force: true });
    } catch { /* empty */ }
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it('uses fresh cache when available', async () => {
    const cachedSpells = [makeRawSpell('Fireball', 3), makeRawSpell('Heal', 1)];
    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(CACHE_FILE, JSON.stringify(cachedSpells));

    global.fetch = vi.fn().mockRejectedValue(new Error('Should not fetch'));

    const result = await fetchFoundrySpells();

    expect(result).toEqual(cachedSpells);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('fetches from GitHub when cache is stale', async () => {
    const staleSpells = [makeRawSpell('Old Spell', 1)];
    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(CACHE_FILE, JSON.stringify(staleSpells));

    const staleTime = Date.now() - (8 * 24 * 60 * 60 * 1000);
    await fs.utimes(CACHE_FILE, new Date(staleTime), new Date(staleTime));

    const treeResponse = {
      tree: [
        { path: 'packs/pf2e/spells/fireball.json', type: 'blob', sha: 'abc', url: '' },
      ],
      truncated: false,
    };

    const freshSpell = makeRawSpell('Fireball', 3);

    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => treeResponse,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => freshSpell,
      } as Response);

    const result = await fetchFoundrySpells();

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Fireball');
    expect(global.fetch).toHaveBeenCalled();
  });

  it('uses stale cache when GitHub fetch fails', async () => {
    const staleSpells = [makeRawSpell('Stale Spell', 2)];
    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(CACHE_FILE, JSON.stringify(staleSpells));

    const staleTime = Date.now() - (8 * 24 * 60 * 60 * 1000);
    await fs.utimes(CACHE_FILE, new Date(staleTime), new Date(staleTime));

    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const result = await fetchFoundrySpells();

    expect(result).toEqual(staleSpells);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('using stale cache')
    );
  });

  it('returns empty array when no cache and fetch fails', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const result = await fetchFoundrySpells();

    expect(result).toEqual([]);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('unavailable')
    );
  });

  it('filters non-spell entries from fetched data', async () => {
    const treeResponse = {
      tree: [
        { path: 'packs/pf2e/spells/fireball.json', type: 'blob', sha: 'abc', url: '' },
        { path: 'packs/pf2e/spells/feat-thing.json', type: 'blob', sha: 'def', url: '' },
      ],
      truncated: false,
    };

    const spellData = makeRawSpell('Fireball', 3);
    const featData = { ...makeRawSpell('Feat Thing', 1), type: 'feat' };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => treeResponse,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => spellData,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => featData,
      } as Response);

    const result = await fetchFoundrySpells();

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Fireball');
  });

  it('writes cache after successful fetch', async () => {
    const treeResponse = {
      tree: [
        { path: 'packs/pf2e/spells/heal.json', type: 'blob', sha: 'abc', url: '' },
      ],
      truncated: false,
    };

    const spellData = makeRawSpell('Heal', 1);

    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => treeResponse,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => spellData,
      } as Response);

    await fetchFoundrySpells();

    const cacheExists = await fs.access(CACHE_FILE).then(() => true).catch(() => false);
    expect(cacheExists).toBe(true);

    const cachedContent = await fs.readFile(CACHE_FILE, 'utf-8');
    const parsed = JSON.parse(cachedContent) as FoundrySpellRaw[];
    expect(parsed).toHaveLength(1);
    expect(parsed[0].name).toBe('Heal');
  });

  it('handles individual file fetch failures gracefully', async () => {
    const treeResponse = {
      tree: [
        { path: 'packs/pf2e/spells/good.json', type: 'blob', sha: 'abc', url: '' },
        { path: 'packs/pf2e/spells/bad.json', type: 'blob', sha: 'def', url: '' },
      ],
      truncated: false,
    };

    const goodSpell = makeRawSpell('Good Spell', 1);

    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => treeResponse,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => goodSpell,
      } as Response)
      .mockRejectedValueOnce(new Error('404'));

    const result = await fetchFoundrySpells();

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Good Spell');
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('1 fetch errors')
    );
  });
});
