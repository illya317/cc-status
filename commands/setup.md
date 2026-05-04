---
description: Configure cc-status as the Claude Code status line
allowed-tools: Bash
---
Run this single command with no modifications:

```bash
python3 -c "import json; from pathlib import Path; p = Path.home() / '.claude' / 'settings.local.json'; d = json.loads(p.read_text()) if p.exists() else {}; d['statusLine'] = {'type': 'command', 'command': 'node ~/.claude/plugins/marketplaces/cc-status/dist/index.js', 'padding': 0}; p.write_text(json.dumps(d, indent=2, ensure_ascii=False)); print('Done')"
```

Report: Status line configured. Restart Claude Code to see it. For balance display add `DEEPSEEK_API_KEY` to `~/.env`.
