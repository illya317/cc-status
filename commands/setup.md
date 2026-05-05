---
description: Configure cc-status as the Claude Code status line
allowed-tools: Read, Write
---

1. Use Read to load `~/.claude/settings.local.json`. If the file does not exist, create `~/.claude/settings.local.json` containing `{}` and re-read it.

2. Add `"statusLine": { "type": "command", "command": "node ~/.claude/plugins/marketplaces/cc-status/dist/index.js", "padding": 0, "refreshInterval": 1 }` and `"subagentStatusLine": { "type": "command", "command": "node ~/.claude/plugins/marketplaces/cc-status/dist/index.js" }` to the JSON object. Do not modify any other keys.

3. Use Write to save the result back to `~/.claude/settings.local.json`.

4. Print exactly: "✓ Status line configured. Restart Claude Code. For balance: add DEEPSEEK_API_KEY to ~/.env"
