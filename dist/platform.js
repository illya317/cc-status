import { readFileSync, existsSync } from 'node:fs';
import https from 'node:https';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCache, isCacheValid, saveCache } from './cache.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── API Endpoints ──────────────────────────────────────────────
const KIMI_API_URL = 'www.kimi.com';
const KIMI_API_PATH = '/apiv2/kimi.gateway.billing.v1.BillingService/GetUsages';
const DEEPSEEK_API_HOST = 'api.deepseek.com';
const DEEPSEEK_API_PATH = '/user/balance';
const MINIMAX_API_HOST = 'api.minimax.chat';
const MINIMAX_API_PATH = '/v1/api/openplatform/coding_plan/remains';
const GLM_DEFAULT_BASE = 'https://open.bigmodel.cn/api/anthropic';

// ── Env helpers ────────────────────────────────────────────────

let _envLoaded = false;

// Load env at module init so process.env has API keys before spawning workers
loadEnv();

function loadEnv() {
  if (_envLoaded) return;
  _envLoaded = true;

  const paths = [
    join(__dirname, '..', '.env'),
    join(process.env.HOME || '', '.env'),
    join(process.cwd(), '.env'),
  ];
  for (const p of paths) {
    try {
      if (!existsSync(p)) continue;
      const content = readFileSync(p, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) continue;
        let key = trimmed.slice(0, eqIdx).trim();
        // Strip 'export ' prefix (shell-style .env)
        if (key.startsWith('export ')) key = key.slice(7);
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) process.env[key] = val;
      }
    } catch {}
  }
}

function getEnv(key) {
  loadEnv();
  return (process.env[key] || '').trim();
}

// ── HTTP helper ───────────────────────────────────────────────

function apiRequest(url, opts = {}) {
  const { hostname = url, path = '/', method = 'GET', headers = {}, body, timeout = 3000 } = opts;

  return new Promise((resolve) => {
    const req = https.request({
      hostname,
      path,
      method,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        ...headers,
      },
      timeout,
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });

    if (body) {
      req.setHeader('Content-Type', 'application/json');
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

// ── Time formatters ───────────────────────────────────────────

function formatTimeRemaining(totalSeconds) {
  if (totalSeconds <= 0) return '';
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (days > 0) return `${days}d${hours}h`;
  if (hours > 0) return `${hours}h${minutes}m`;
  return `${minutes}m`;
}

function formatIsoRemaining(isoStr) {
  try {
    const dt = new Date(isoStr);
    if (isNaN(dt.getTime())) return '';
    const delta = Math.floor((dt.getTime() - Date.now()) / 1000);
    return formatTimeRemaining(delta);
  } catch {
    return '';
  }
}

function formatMsRemaining(ms) {
  return formatTimeRemaining(Math.floor(ms / 1000));
}

// ── Platform API fetchers ─────────────────────────────────────

async function fetchKimiRaw() {
  const cookie = getEnv('KIMI_COOKIE');
  if (!cookie) return null;

  const data = await apiRequest(KIMI_API_URL, {
    path: KIMI_API_PATH,
    method: 'POST',
    headers: { Authorization: `Bearer ${cookie}` },
    body: { scope: [4] },
    timeout: 2000,
  });
  if (!data) return null;

  const usages = data.usages || [];
  if (usages.length === 0) return null;

  const detail = usages[0].detail || {};
  const limit = parseInt(detail.limit, 10) || 0;
  const used = parseInt(detail.used, 10) || 0;
  const resetTime = detail.resetTime || '';
  const pct = limit ? Math.round((used / limit) * 100) : 0;
  const resetAtMs = resetTime ? new Date(resetTime).getTime() : 0;
  return { percent: pct, resetAtMs };
}

async function fetchDeepseekRaw() {
  const apiKey = getEnv('DEEPSEEK_API_KEY');
  if (!apiKey) return null;

  const data = await apiRequest(DEEPSEEK_API_HOST, {
    path: DEEPSEEK_API_PATH,
    headers: { Authorization: `Bearer ${apiKey}` },
    timeout: 2000,
  });
  if (!data) return null;

  const infos = data.balance_infos || [];
  if (infos.length === 0) return null;

  const total = infos[0].total_balance || '?';
  return { balance: `¥${total}` };
}

async function fetchMinimaxRaw() {
  const apiKey = getEnv('MINIMAX_API_KEY');
  if (!apiKey) return null;

  const data = await apiRequest(MINIMAX_API_HOST, {
    path: MINIMAX_API_PATH,
    headers: { Authorization: `Bearer ${apiKey}` },
    timeout: 2000,
  });
  if (!data) return null;

  const base = data.base_resp || {};
  if (base.status_code !== 0) return null;

  const remains = data.model_remains || [];
  for (const r of remains) {
    if (r.model_name === 'MiniMax-M*') {
      const total = r.current_interval_total_count || 0;
      const used = r.current_interval_usage_count || 0;
      const rem = total - used;
      const pct = total > 0 ? Math.round((rem / total) * 100) : 0;
      const resetAtMs = Date.now() + (r.remains_time || 0);
      return { percent: pct, resetAtMs };
    }
  }
  return null;
}

async function fetchGlmRaw() {
  const token = getEnv('ANTHROPIC_AUTH_TOKEN');
  if (!token) return null;

  const rawBase = getEnv('ANTHROPIC_BASE_URL') || GLM_DEFAULT_BASE;
  let baseUrl = rawBase.replace(/\/+$/, '');
  if (!baseUrl.startsWith('http')) baseUrl = 'https://' + baseUrl;

  // Strip /anthropic suffix for monitor API (same as upstream glm-plan-usage)
  baseUrl = baseUrl.replace('/api/anthropic', '/api').replace('/anthropic', '');

  let hostname, basePath;
  try {
    const u = new URL(baseUrl);
    hostname = u.hostname;
    basePath = u.pathname.replace(/\/+$/, '');
  } catch {
    return null;
  }

  const data = await apiRequest(hostname, {
    path: basePath + '/monitor/usage/quota/limit',
    headers: { Authorization: `Bearer ${token}` },
    timeout: 2000,
  });
  if (!data || !data.success) return null;

  const items = (data.data && data.data.limits) || [];
  // Prefer unit 6 (weekly), fallback to unit 3 (5-hour rolling)
  const weekQuota = items.find(q => q.type === 'TOKENS_LIMIT' && q.unit === 6);
  const hourQuota = items.find(q => q.type === 'TOKENS_LIMIT' && q.unit === 3);
  const tokensQuota = weekQuota || hourQuota;
  if (tokensQuota) {
    const pct = tokensQuota.percentage != null ? Math.round(tokensQuota.percentage) : 0;
    const resetAtMs = tokensQuota.nextResetTime || 0;
    return { percent: pct, resetAtMs };
  }

  return null;
}

// ── Main entry ────────────────────────────────────────────────

/**
 * Fetch platform balance/quota data with simple mtime-based caching.
 * Synchronous refresh when stale (3 APIs in parallel, 2s timeout each).
 * Returns { kimi?: {...}, deepseek?: {...}, minimax?: {...} }
 */
export async function fetchPlatformData(cacheTtl = 10) {
  const cache = loadCache();
  const platforms = {};

  for (const key of ['kimi', 'deepseek', 'minimax', 'glm']) {
    if (cache[key] && typeof cache[key] === 'object') {
      const pdata = { ...cache[key] };
      // Format countdown timers fresh each time
      if (pdata.resetAtMs) {
        const delta = Math.floor((pdata.resetAtMs - Date.now()) / 1000);
        pdata.reset = formatTimeRemaining(delta);
      }
      platforms[key] = pdata;
    }
  }

  if (isCacheValid(cache, cacheTtl)) return platforms;

  // Cache stale — fetch synchronously (fast, parallel, short timeout)
  const fetchers = {
    kimi: fetchKimiRaw,
    deepseek: fetchDeepseekRaw,
    minimax: fetchMinimaxRaw,
    glm: fetchGlmRaw,
  };

  const results = await Promise.allSettled(
    Object.entries(fetchers).map(async ([key, fn]) => {
      try {
        const data = await fn();
        return { key, data };
      } catch {
        return { key, data: null };
      }
    })
  );

  let updated = false;
  for (const result of results) {
    if (result.status !== 'fulfilled') continue;
    const { key, data } = result.value;
    if (data) {
      cache[key] = data;
      const pdata = { ...data };
      if (pdata.resetAtMs) pdata.reset = formatTimeRemaining(Math.floor((pdata.resetAtMs - Date.now()) / 1000));
      platforms[key] = pdata;
      updated = true;
    }
  }

  if (updated) {
    cache.updated_at = Date.now() / 1000;
    saveCache(cache);
  }

  return platforms;
}
