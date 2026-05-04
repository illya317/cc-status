// Price table (CNY per 1M tokens unless noted)
const PRICES = {
  'deepseek-v4-flash': {
    input_cache_hit: 0.02,
    input_cache_miss: 1.00,
    output: 2.00,
    currency: 'CNY',
  },
  'deepseek-v4-pro': {
    input_cache_hit: 0.10,
    input_cache_miss: 12.00,
    output: 24.00,
    currency: 'CNY',
  },
  'kimi': {
    input_cache_hit: 1.10,
    input_cache_miss: 6.50,
    output: 27.00,
    currency: 'CNY',
  },
  'kimi-k2.6': {
    input_cache_hit: 1.10,
    input_cache_miss: 6.50,
    output: 27.00,
    currency: 'CNY',
  },
  'gpt-5.5': {
    input_cache_hit: 0.50,
    input_cache_miss: 5.00,
    output: 30.00,
    currency: 'USD',
  },
};

// DeepSeek V4 Pro promo: 2.5折 until May 31 2026 15:59 UTC
const DS_V4_PRO_PROMO = {
  input_cache_hit: 0.025,
  input_cache_miss: 3.00,
  output: 6.00,
  currency: 'CNY',
};

const PROMO_END = new Date('2026-05-31T15:59:59Z');

function isPromo() {
  return Date.now() < PROMO_END.getTime();
}

/**
 * Resolve pricing for a given model ID.
 * Tries exact match first, then substring match.
 * Returns null if no matching price found.
 */
export function resolvePrice(modelId) {
  if (!modelId) return null;

  // Exact match
  if (modelId in PRICES) {
    const price = PRICES[modelId];
    if (modelId === 'deepseek-v4-pro' && isPromo()) return DS_V4_PRO_PROMO;
    return price;
  }

  // Substring match
  const lowered = modelId.toLowerCase();
  for (const [key, p] of Object.entries(PRICES)) {
    if (lowered.includes(key)) {
      if (key === 'deepseek-v4-pro' && isPromo()) return DS_V4_PRO_PROMO;
      return p;
    }
  }

  return null;
}

function calcSingle(usage, price) {
  const cacheRead = usage.cache_read_input_tokens || 0;
  const input = usage.input_tokens || 0;
  const cacheCreation = usage.cache_creation_input_tokens || 0;
  const output = usage.output_tokens || 0;

  return (
    cacheRead * price.input_cache_hit +
    (input + cacheCreation) * price.input_cache_miss +
    output * price.output
  ) / 1_000_000;
}

/**
 * Calculate cost. Accepts single usage dict or array of per-call dicts.
 * Returns { cost: number, currency: 'CNY'|'USD' } or null.
 */
export function calcCost(usage, modelId) {
  const price = resolvePrice(modelId);
  if (!price) return null;

  let totalCost = 0;
  if (Array.isArray(usage)) {
    for (const call of usage) {
      totalCost += calcSingle(call, price);
    }
  } else {
    totalCost = calcSingle(usage, price);
  }

  return { cost: totalCost, currency: price.currency };
}
