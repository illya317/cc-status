import { basename } from 'node:path';
import { loadConfig } from './config.js';
import { parseTranscript, calcCacheHitRate, calcIdleTime } from './transcript.js';
import { calcCost } from './pricing.js';
import { getGitInfo } from './git.js';
import { fetchPlatformData } from './platform.js';
import { buildSegments, render, renderSubagentRows } from './render.js';

/**
 * Read JSON from stdin (piped from Claude Code).
 */
function readStdin() {
  return new Promise((resolve, reject) => {
    // No piped input
    if (process.stdin.isTTY) {
      resolve(null);
      return;
    }

    let data = '';
    const timer = setTimeout(() => {
      if (!data) {
        resolve(null);
      }
    }, 250);

    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      clearTimeout(timer);
      data += chunk;
    });

    process.stdin.on('end', () => {
      clearTimeout(timer);
      try {
        resolve(JSON.parse(data));
      } catch {
        resolve(null);
      }
    });

    process.stdin.on('error', () => {
      clearTimeout(timer);
      resolve(null);
    });
  });
}

export async function main() {
  try {
    const stdinData = await readStdin();
    if (!stdinData) {
      console.log('[cc-status] waiting for stdin...');
      return;
    }

    // subagentStatusLine mode: tasks array present
    if (stdinData.tasks && Array.isArray(stdinData.tasks)) {
      const rows = renderSubagentRows(stdinData.tasks);
      for (const row of rows) {
        console.log(JSON.stringify(row));
      }
      return;
    }

    const cfg = loadConfig();
    const segCfg = cfg.segments;
    const thrCfg = cfg.thresholds;
    const dispCfg = cfg.display;

    const modelId = stdinData.model?.id || '';
    let modelName = stdinData.model?.display_name || '?';
    // Shorten third-party model names (fuzzy match, all lowercase)
    const ml = modelId.toLowerCase();
    if (ml.includes('deepseek')) {
      if (ml.includes('pro')) modelName = 'ds-pro';
      else if (ml.includes('flash')) modelName = 'ds-flash';
      else modelName = 'ds';
    } else if (ml.includes('kimi')) {
      modelName = 'kimi';
    } else if (ml.includes('minimax')) {
      modelName = 'mmx';
    } else if (ml.includes('gpt')) {
      modelName = 'gpt';
    } else if (ml.includes('glm')) {
      modelName = 'glm';
    }
    const cwd = stdinData.workspace?.current_dir || stdinData.cwd || '';
    const dirname = basename(cwd) || cwd;
    const transcriptPath = stdinData.transcript_path || '';
    const ctxWindow = stdinData.context_window || {};
    const pct = ctxWindow.used_percentage || 0;

    const isThirdParty = !modelId.startsWith('claude-');

    let cacheHitRate = 0;
    let costStr = '';

    if (isThirdParty) {
      const { usage, calls } = await parseTranscript(transcriptPath);
      if (usage) {
        cacheHitRate = calcCacheHitRate(usage);
        const costResult = calcCost(calls, modelId);
        if (costResult) {
          const sym = costResult.currency === 'CNY' ? '¥' : '$';
          costStr = `${sym}${costResult.cost.toFixed(2)}`;
        } else {
          costStr = '?';
        }
      } else {
        cacheHitRate = 0;
        costStr = '?';
      }
    } else {
      // Claude official: use stdin cost and context_window.current_usage
      const usage = ctxWindow.current_usage || {};
      cacheHitRate = calcCacheHitRate(usage);
      const totalCost = stdinData.cost?.total_cost_usd || 0;
      costStr = `$${totalCost.toFixed(2)}`;
    }

    // Git info
    const git = await getGitInfo(cwd);

    // Idle timer
    const idleStr = await calcIdleTime(transcriptPath, dispCfg.idle_cutoff_seconds);

    // Platform balance
    let platformData = {};
    const modelLower = modelId.toLowerCase();
    if (modelLower.includes('kimi') || modelLower.includes('deepseek') || modelLower.includes('minimax') || modelLower.includes('glm')) {
      platformData = await fetchPlatformData(dispCfg.cache_ttl_seconds);
    }

    const agentName = stdinData.agent?.name || '';

    const ctx = {
      modelId, modelName, cwd, dirname,
      pct, ctxWidth: dispCfg.context_bar_width,
      platWidth: dispCfg.usage_bar_width,
      cacheHitRate, idleStr, costStr, git, platformData,
      thresholds: thrCfg, segCfg, agentName,
    };

    const segments = buildSegments(ctx);
    let output = render(segments, dispCfg.layout);
    if (dispCfg.padding_lines > 0) output += '\n'.repeat(dispCfg.padding_lines);
    console.log(output);
  } catch (err) {
    console.error('[cc-status]', err.message);
  }
}

// Direct execution detection (like claude-hud)
import { fileURLToPath } from 'node:url';
const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] === scriptPath) {
  main();
}
