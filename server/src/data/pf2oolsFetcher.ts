import { promises as fs } from 'fs';
import * as path from 'path';

const PF2OOLS_BASE = 'https://raw.githubusercontent.com/Pf2ools/pf2ools-data/master/bundles/byDatatype/core';
const CACHE_DIR = 'data/cache';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export async function fetchPf2oolsData(type: 'feat' | 'spell'): Promise<unknown[]> {
  const cacheFile = path.join(CACHE_DIR, `pf2ools-${type}.json`);
  
  const cachedData = await tryReadCache(cacheFile);
  
  if (cachedData && await isCacheFresh(cacheFile)) {
    return cachedData;
  }
  
  try {
    const url = `${PF2OOLS_BASE}/${type}.json`;
    const response = await fetch(url);
    const data = await response.json() as unknown[];
    await writeCache(cacheFile, data);
    return data;
  } catch (error) {
    if (cachedData) {
      console.warn(`Pf2ools fetch failed, using stale cache: ${error}`);
      return cachedData;
    }
    console.error(`Pf2ools data unavailable, feat effects disabled: ${error}`);
    return [];
  }
}

async function tryReadCache(filePath: string): Promise<unknown[] | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as unknown[];
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

async function writeCache(filePath: string, data: unknown[]): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}
