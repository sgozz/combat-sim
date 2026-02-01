import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { fetchPf2oolsData } from './pf2oolsFetcher';
import path from 'path';

const CACHE_DIR = 'data/cache';
const TEST_CACHE_DIR = 'data/cache-test';

describe('fetchPf2oolsData', () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    try {
      await fs.rm(CACHE_DIR, { recursive: true, force: true });
    } catch {
      // Ignore if doesn't exist
    }
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(async () => {
    try {
      await fs.rm(CACHE_DIR, { recursive: true, force: true });
    } catch {
      // Ignore if doesn't exist
    }
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('returns feat array from GitHub when cache is empty', async () => {
    const mockData = [
      { name: 'Power Attack', level: 1 },
      { name: 'Sudden Charge', level: 1 }
    ];

    // Mock fetch to return sample data
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockData
    } as Response);

    const result = await fetchPf2oolsData('feat');

    expect(result).toEqual(mockData);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://raw.githubusercontent.com/Pf2ools/pf2ools-data/master/bundles/byDatatype/core/feat.json'
    );

    // Verify cache was written
    const cacheFile = path.join(CACHE_DIR, 'pf2ools-feat.json');
    const cacheExists = await fs.access(cacheFile).then(() => true).catch(() => false);
    expect(cacheExists).toBe(true);

    if (cacheExists) {
      const cachedContent = await fs.readFile(cacheFile, 'utf-8');
      expect(JSON.parse(cachedContent)).toEqual(mockData);
    }
  });

  it('uses cache when fresh (within 24h)', async () => {
    const cachedData = [
      { name: 'Cached Feat', level: 2 }
    ];

    // Create fresh cache file
    const cacheFile = path.join(CACHE_DIR, 'pf2ools-spell.json');
    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(cacheFile, JSON.stringify(cachedData));

    // Mock fetch to fail (should not be called)
    global.fetch = vi.fn().mockRejectedValue(new Error('Should not fetch'));

    const result = await fetchPf2oolsData('spell');

    expect(result).toEqual(cachedData);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('uses stale cache when fetch fails', async () => {
    const staleData = [
      { name: 'Stale Feat', level: 3 }
    ];

    // Create stale cache file (>24h old)
    const cacheFile = path.join(CACHE_DIR, 'pf2ools-feat.json');
    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(cacheFile, JSON.stringify(staleData));

    // Set file mtime to 25 hours ago
    const staleTime = Date.now() - (25 * 60 * 60 * 1000);
    await fs.utimes(cacheFile, new Date(staleTime), new Date(staleTime));

    // Mock fetch to throw error
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const result = await fetchPf2oolsData('feat');

    expect(result).toEqual(staleData);
    expect(global.fetch).toHaveBeenCalled();
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Pf2ools fetch failed, using stale cache')
    );
  });

  it('returns empty array when no cache and fetch fails', async () => {
    // No cache file exists
    // Mock fetch to throw error
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const result = await fetchPf2oolsData('spell');

    expect(result).toEqual([]);
    expect(global.fetch).toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Pf2ools data unavailable, feat effects disabled')
    );
  });

  it('writes cache after successful fetch', async () => {
    const mockData = [
      { name: 'Magic Missile', level: 1 },
      { name: 'Fireball', level: 3 }
    ];

    // Mock fetch to return data
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockData
    } as Response);

    await fetchPf2oolsData('spell');

    // Assert cache file is created with correct data
    const cacheFile = path.join(CACHE_DIR, 'pf2ools-spell.json');
    const cacheExists = await fs.access(cacheFile).then(() => true).catch(() => false);
    expect(cacheExists).toBe(true);

    if (cacheExists) {
      const cachedContent = await fs.readFile(cacheFile, 'utf-8');
      expect(JSON.parse(cachedContent)).toEqual(mockData);
    }
  });

  it('refreshes stale cache with new data on successful fetch', async () => {
    const staleData = [{ name: 'Old Feat', level: 1 }];
    const freshData = [{ name: 'New Feat', level: 2 }];

    // Create stale cache
    const cacheFile = path.join(CACHE_DIR, 'pf2ools-feat.json');
    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(cacheFile, JSON.stringify(staleData));

    // Set file mtime to 25 hours ago
    const staleTime = Date.now() - (25 * 60 * 60 * 1000);
    await fs.utimes(cacheFile, new Date(staleTime), new Date(staleTime));

    // Mock fetch to return new data
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => freshData
    } as Response);

    const result = await fetchPf2oolsData('feat');

    expect(result).toEqual(freshData);
    expect(global.fetch).toHaveBeenCalled();

    // Verify cache was updated
    const cachedContent = await fs.readFile(cacheFile, 'utf-8');
    expect(JSON.parse(cachedContent)).toEqual(freshData);
  });
});
