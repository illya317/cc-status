import { mkdirSync, readFileSync, writeFileSync, unlinkSync, renameSync, statSync, openSync, closeSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const CACHE_DIR = join(homedir(), '.claude');
const CACHE_FILE = join(CACHE_DIR, '.cc-status-cache.json');
const CACHE_LOCK_FILE = join(CACHE_DIR, '.cc-status-cache.lock');
const CACHE_LOCK_STALE = 30_000;

export function loadCache() {
  try {
    return JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
  } catch {
    return {};
  }
}

export function isCacheValid(cache, ttlSec) {
  const updated = cache.updated_at || 0;
  return (Date.now() / 1000 - updated) < ttlSec;
}

export function acquireLock() {
  try {
    const fd = openSync(CACHE_LOCK_FILE, 'wx');
    closeSync(fd);
    return true;
  } catch (err) {
    if (err.code !== 'EEXIST') return false;
    try {
      const stat = statSync(CACHE_LOCK_FILE);
      if (Date.now() - stat.mtimeMs > CACHE_LOCK_STALE) {
        unlinkSync(CACHE_LOCK_FILE);
        const fd = openSync(CACHE_LOCK_FILE, 'wx');
        closeSync(fd);
        return true;
      }
    } catch {
      return false;
    }
    return false;
  }
}

export function releaseLock() {
  try { unlinkSync(CACHE_LOCK_FILE); } catch {}
}

export function saveCache(data) {
  const tmpfile = join(CACHE_DIR, '.cc-status-cache-' + Date.now() + '-' + Math.random().toString(36).slice(2));
  try {
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(tmpfile, JSON.stringify(data), 'utf8');
    renameSync(tmpfile, CACHE_FILE);
  } catch {
    try { unlinkSync(tmpfile); } catch {}
  }
}
