import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const DEFAULT_CONFIG = {
  segments: {
    model: true,
    project: true,
    context: true,
    cache: true,
    usage: true,
    cost: true,
  },
  thresholds: {
    context_green: 50,
    context_yellow: 80,
    cache_green: 90,
    cache_yellow: 80,
  },
  display: {
    layout: 'compact',
    context_bar_width: 5,
    usage_bar_width: 5,
    idle_cutoff_seconds: 3600,
    cache_ttl_seconds: 10,
  },
};

function getClaudeConfigDir(homeDir = homedir()) {
  const envDir = process.env.CLAUDE_CONFIG_DIR?.trim();
  if (envDir) return envDir;
  return join(homeDir, '.claude');
}

function getPluginDir(homeDir = homedir()) {
  return join(getClaudeConfigDir(homeDir), 'plugins', 'cc-status');
}

function loadJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function mergeSection(defaults, user, keys) {
  const result = { ...defaults };
  if (!user || typeof user !== 'object') return result;
  for (const key of keys) {
    if (key in user && user[key] !== undefined) {
      const val = user[key];
      // Clamp numeric values
      if (typeof defaults[key] === 'number' && typeof val === 'number') {
        result[key] = Math.max(0, val);
      } else {
        result[key] = val;
      }
    }
  }
  return result;
}

export function loadConfig() {
  // Try plugin config first, then fall back to global cc-status.json
  const pluginConfig = loadJson(join(getPluginDir(), 'config.json'));
  const globalConfig = loadJson(join(getClaudeConfigDir(), 'cc-status.json'));
  const user = pluginConfig ?? globalConfig ?? {};

  return {
    segments: mergeSection(DEFAULT_CONFIG.segments, user.segments, Object.keys(DEFAULT_CONFIG.segments)),
    thresholds: mergeSection(DEFAULT_CONFIG.thresholds, user.thresholds, Object.keys(DEFAULT_CONFIG.thresholds)),
    display: mergeSection(DEFAULT_CONFIG.display, user.display, Object.keys(DEFAULT_CONFIG.display)),
  };
}
