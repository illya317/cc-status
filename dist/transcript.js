import { createInterface } from 'node:readline';
import { createReadStream } from 'node:fs';

/**
 * Parse JSONL transcript, extracting token usage from assistant messages.
 * Deduplicates by message.id.
 */
export async function parseTranscript(transcriptPath) {
  const seenIds = new Set();
  const usage = {
    input_tokens: 0,
    cache_read_input_tokens: 0,
    cache_creation_input_tokens: 0,
    output_tokens: 0,
  };
  const calls = [];

  try {
    const stream = createReadStream(transcriptPath, { encoding: 'utf8' });
    const rl = createInterface({ input: stream, crlfDelay: Infinity });

    let lastModel = '';

    for await (const line of rl) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const data = JSON.parse(trimmed);

        // Primary: assistant message usage
        if (data.type === 'assistant') {
          lastModel = (data.message && data.message.model) || lastModel;
          const msg = data.message || {};
          const u = msg.usage;
          if (!u) continue;

          const msgId = msg.id || data.uuid || '';
          if (msgId && seenIds.has(msgId)) continue;
          if (msgId) seenIds.add(msgId);

          const call = {
            model: msg.model || data.model || '',
            input_tokens: u.input_tokens || 0,
            cache_read_input_tokens: u.cache_read_input_tokens || 0,
            cache_creation_input_tokens: u.cache_creation_input_tokens || 0,
            output_tokens: u.output_tokens || 0,
          };
          calls.push(call);

          usage.input_tokens += call.input_tokens;
          usage.cache_read_input_tokens += call.cache_read_input_tokens;
          usage.cache_creation_input_tokens += call.cache_creation_input_tokens;
          usage.output_tokens += call.output_tokens;
        }

        // Sub-agent tool use result tokens (in user messages)
        const tur = data.toolUseResult;
        if (tur && typeof tur === 'object' && tur.usage) {
          const tu = tur.usage;
          const call = {
            model: lastModel,
            input_tokens: tu.input_tokens || 0,
            cache_read_input_tokens: tu.cache_read_input_tokens || 0,
            cache_creation_input_tokens: tu.cache_creation_input_tokens || 0,
            output_tokens: tu.output_tokens || 0,
          };
          calls.push(call);

          usage.input_tokens += call.input_tokens;
          usage.cache_read_input_tokens += call.cache_read_input_tokens;
          usage.cache_creation_input_tokens += call.cache_creation_input_tokens;
          usage.output_tokens += call.output_tokens;
        }
      } catch {
        // Skip malformed lines
      }
    }
    stream.destroy();
  } catch {
    // File not found or unreadable
  }

  return { usage: calls.length > 0 ? usage : null, calls };
}

/**
 * Cache hit rate: cache_read / (cache_read + input) * 100
 */
export function calcCacheHitRate(usage) {
  if (!usage) return 0;
  const cacheRead = usage.cache_read_input_tokens || 0;
  const input = usage.input_tokens || 0;
  const denom = cacheRead + input;
  return denom > 0 ? (cacheRead / denom) * 100 : 0;
}

/**
 * Time since last assistant message in the transcript.
 * Returns human-readable string like "3m", "2h" or "" if over cutoff.
 */
export async function calcIdleTime(transcriptPath, cutoffSeconds = 3600) {
  let lastTs = null;

  try {
    const stream = createReadStream(transcriptPath, { encoding: 'utf8' });
    const rl = createInterface({ input: stream, crlfDelay: Infinity });

    for await (const line of rl) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const data = JSON.parse(trimmed);
        if (data.type !== 'assistant') continue;
        if (data.timestamp) lastTs = data.timestamp;
      } catch {}
    }
    stream.destroy();
  } catch {
    return '';
  }

  if (!lastTs) return '';

  const last = new Date(lastTs);
  if (isNaN(last.getTime())) return '';

  const delta = Date.now() - last.getTime();
  const totalSeconds = Math.floor(delta / 1000);

  if (totalSeconds < 0 || totalSeconds >= cutoffSeconds) return '';
  if (totalSeconds < 60) return `${totalSeconds}s`;
  if (totalSeconds < 3600) return `${Math.floor(totalSeconds / 60)}m`;
  if (totalSeconds < 86400) return `${Math.floor(totalSeconds / 3600)}h`;
  return `${Math.floor(totalSeconds / 86400)}d`;
}
