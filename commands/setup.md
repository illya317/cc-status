---
description: Configure cc-status as the Claude Code status line
allowed-tools: Read, Bash
---

# Setup cc-status

Read `~/.claude/settings.json` and `~/.claude/settings.local.json` (if exists).

## Step 1: Register statusLine

If `statusLine` is not already set to cc-status in `settings.local.json`, write it:

```json
"statusLine": {
  "type": "command",
  "command": "node ~/.claude/plugins/cc-status/dist/index.js",
  "padding": 0
}
```

Prefer `settings.local.json` so it overrides global settings. Merge it with existing content (don't overwrite other keys).

## Step 2: Verify

Run `echo '{"model":{"id":"deepseek-v4-pro","display_name":"Test"}}' | node ~/.claude/plugins/cc-status/dist/index.js` to verify the plugin works.

## Step 3: Done

Tell the user:
- **Status line is active.** Restart Claude Code or send a message to see it.
- **Balance display** requires API keys in `~/.env`:
  - `DEEPSEEK_API_KEY` — DeepSeek balance
  - `KIMI_COOKIE` — Kimi quota (browser cookie from kimi.com)
  - `MINIMAX_API_KEY` — MiniMax quota
- **Config**: edit `~/.claude/plugins/cc-status/config.json` to toggle segments or adjust thresholds
