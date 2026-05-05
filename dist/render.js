// ANSI 24-bit truecolor helpers
export function ansiFg(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `\x1b[38;2;${r};${g};${b}m`;
}

export function ansiReset() {
  return '\x1b[0m';
}

// Starship-inspired color palette
export const COLORS = {
  lavender: '#a3aed2',
  blue: '#769ff0',
  fg_light: '#e3e5e5',
  fg_dim: '#a0a9cb',
  green: '#4ade80',
  yellow: '#facc15',
  red: '#f87171',
};

export function usageBar(pct, width = 5) {
  const filled = Math.round((pct / 100) * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

function joinSegments(segments) {
  const sep = ansiFg(COLORS.fg_dim) + ' │ ' + ansiReset();
  return segments.map(s => ansiFg(s.fg) + s.text + ansiReset()).join(sep);
}

export function render({ segments, agentSegment }, layout) {
  let output;
  if (layout === 'split' && segments.length >= 3) {
    const top = segments.slice(0, 2);
    const bottom = segments.slice(2);
    output = joinSegments(top) + '\n' + joinSegments(bottom);
  } else {
    output = joinSegments(segments);
  }
  if (agentSegment) {
    output += '\n' + joinSegments([agentSegment]);
  }
  return output;
}

export function buildSegments(ctx) {
  const { modelName, dirname, pct, ctxWidth, platWidth, cacheHitRate,
          idleStr, costStr, git, platformData, thresholds, segCfg, modelId, agentName } = ctx;
  const segments = [];
  let agentSegment = null;

  // 1. Model
  if (segCfg.model) {
    segments.push({ text: `[${modelName}]`, fg: COLORS.fg_light });
  }

  // 2. Project + Git
  if (segCfg.project) {
    let text = ansiFg(COLORS.blue) + dirname + ansiReset();
    if (git) {
      const icon = git.dirty ? '*' : '';
      text += ' ' + ansiFg(COLORS.yellow) + `git:(${git.branch}${icon})` + ansiReset();
    }
    segments.push({ text, fg: COLORS.fg_light });
  }

  // 3. Context bar
  if (segCfg.context) {
    const bar = usageBar(pct, ctxWidth);
    let color = COLORS.green;
    if (pct >= thresholds.context_yellow) color = COLORS.red;
    else if (pct >= thresholds.context_green) color = COLORS.yellow;
    segments.push({ text: `${bar} ${Math.round(pct)}%`, fg: color });
  }

  // 4. Cache + idle timer
  if (segCfg.cache) {
    const parts = [];
    let pctColor = COLORS.red;
    if (cacheHitRate >= thresholds.cache_green) pctColor = COLORS.green;
    else if (cacheHitRate >= thresholds.cache_yellow) pctColor = COLORS.yellow;

    parts.push(ansiFg(COLORS.fg_dim) + 'Cache' + ansiReset());
    parts.push(ansiFg(pctColor) + Math.round(cacheHitRate) + '%' + ansiReset());
    if (idleStr) parts.push(idleStr);
    segments.push({ text: parts.join(' '), fg: COLORS.fg_light });
  }

  // 5. Platform usage
  if (segCfg.usage) {
    const modelLower = (modelId || '').toLowerCase();
    let currentPlatform = null;
    if (modelLower.includes('kimi')) currentPlatform = 'kimi';
    else if (modelLower.includes('deepseek')) currentPlatform = 'deepseek';
    else if (modelLower.includes('minimax')) currentPlatform = 'minimax';
    else if (modelLower.includes('glm')) currentPlatform = 'glm';

    if (currentPlatform && platformData[currentPlatform]) {
      const pdata = platformData[currentPlatform];
      let text;
      if (currentPlatform === 'deepseek') {
        text = `balance ${pdata.balance}`;
      } else {
        const bar = usageBar(pdata.percent, platWidth);
        text = `${bar} ${pdata.percent}%`;
        if (pdata.reset) text += ` ${pdata.reset}`;
      }
      segments.push({ text, fg: COLORS.fg_light });
    }
  }

  // 6. Cost
  if (segCfg.cost && costStr && costStr !== '?' && costStr !== '') {
    segments.push({ text: costStr, fg: COLORS.fg_light });
  }

  // 7. Agent
  if (agentName) {
    agentSegment = { text: `agent:${agentName}`, fg: COLORS.lavender };
  }

  return { segments, agentSegment };
}

export function renderSubagentRows(tasks) {
  return tasks.map(t => {
    const statusColor = t.status === 'running' ? COLORS.green
      : t.status === 'error' ? COLORS.red
      : COLORS.fg_dim;
    const label = t.name || t.label || t.id || '?';
    const parts = [
      ansiFg(COLORS.fg_light) + label + ansiReset(),
      ansiFg(statusColor) + t.status + ansiReset(),
    ];
    if (t.tokenCount) {
      parts.push(ansiFg(COLORS.fg_dim) + t.tokenCount + 't' + ansiReset());
    }
    return { id: t.id, content: parts.join(' ') };
  });
}
