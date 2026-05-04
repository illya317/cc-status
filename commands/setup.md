---
description: Configure cc-status as the Claude Code status line
allowed-tools: Bash
---

# Setup cc-status

Run these commands in order. Do not read or edit files manually.

## Step 1: Write statusLine

```bash
python3 -c "
import json
from pathlib import Path
p = Path.home() / '.claude' / 'settings.local.json'
d = json.loads(p.read_text()) if p.exists() else {}
d['statusLine'] = {
    'type': 'command',
    'command': 'node ~/.claude/plugins/marketplaces/cc-status/dist/index.js',
    'padding': 0
}
p.write_text(json.dumps(d, indent=2, ensure_ascii=False))
print('statusLine configured')
"
```

## Step 2: Verify

```bash
echo '{"model":{"id":"deepseek-v4-pro","display_name":"Test"},"workspace":{"current_dir":"/tmp"},"context_window":{"used_percentage":0}}' | node ~/.claude/plugins/marketplaces/cc-status/dist/index.js
```

## Step 3: Done

Report: Status line is active. Restart Claude Code. For balance display, add API keys to `~/.env` — see `~/.claude/plugins/marketplaces/cc-status/.env.example`.
