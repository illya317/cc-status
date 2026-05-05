import { createInterface } from 'node:readline';
import { createReadStream } from 'node:fs';

/**
 * Single-pass JSONL transcript parser.
 * Extracts token usage, last assistant timestamp, and agent entries.
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
  let lastModel = '';
  let lastTs = null;
  const agentMap = new Map();

  try {
    const stream = createReadStream(transcriptPath, { encoding: 'utf8' });
    const rl = createInterface({ input: stream, crlfDelay: Infinity });

    for await (const line of rl) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const data = JSON.parse(trimmed);

        // --- Token usage ---
        if (data.type === 'assistant') {
          lastModel = (data.message && data.message.model) || lastModel;
          if (data.timestamp) lastTs = data.timestamp;
          const msg = data.message || {};
          const u = msg.usage;
          if (u) {
            const msgId = msg.id || data.uuid || '';
            if (msgId && seenIds.has(msgId)) { /* skip duplicate */ }
            else {
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
          }
        }

        // Sub-agent tool use result tokens
        const tur = data.toolUseResult;
        if (tur && typeof tur === 'object' && tur.usage) {
          const tu = tur.usage;
          calls.push({
            model: lastModel,
            input_tokens: tu.input_tokens || 0,
            cache_read_input_tokens: tu.cache_read_input_tokens || 0,
            cache_creation_input_tokens: tu.cache_creation_input_tokens || 0,
            output_tokens: tu.output_tokens || 0,
          });
          usage.input_tokens += tu.input_tokens || 0;
          usage.cache_read_input_tokens += tu.cache_read_input_tokens || 0;
          usage.cache_creation_input_tokens += tu.cache_creation_input_tokens || 0;
          usage.output_tokens += tu.output_tokens || 0;
        }

        // --- Agent detection ---
        const content = data.message?.content;
        if (content && Array.isArray(content)) {
          for (const block of content) {
            if (block.type === 'tool_use' && block.id && (block.name === 'Task' || block.name === 'Agent')) {
              const input = block.input;
              const ts = data.timestamp ? new Date(data.timestamp) : new Date();
              agentMap.set(block.id, {
                id: block.id,
                type: input?.subagent_type ?? 'agent',
                status: 'running',
                description: input?.description || input?.prompt?.slice(0, 80) || '',
                startTime: ts,
              });
            }
            if (block.type === 'tool_result' && block.tool_use_id) {
              const agent = agentMap.get(block.tool_use_id);
              if (agent) {
                agent.status = 'completed';
                agent.endTime = data.timestamp ? new Date(data.timestamp) : new Date();
              }
            }
          }
        }
      } catch {}
    }
    stream.destroy();
  } catch {
    return { usage: null, calls: [], lastTs: null, agents: [] };
  }

  const agentsList = Array.from(agentMap.values());
  const running = agentsList.filter(a => a.status === 'running');
  const completed = agentsList.filter(a => a.status === 'completed');
  const agents = [...running, ...completed.slice(-3)].slice(-5);

  return { usage: calls.length > 0 ? usage : null, calls, lastTs, agents };
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
 * Time since last assistant timestamp.
 */
export function calcIdleTime(lastTs, cutoffSeconds = 3600) {
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
