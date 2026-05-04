🌐 [English](README.md) | [中文文档](README_ZH.md)

---

# cc-status

Claude Code HUD plugin — single-line status bar showing model, cache hit rate, idle timer, platform balance, and session cost.

Supports **Claude official models** (cost from stdin) and **third-party models** (DeepSeek, Kimi, MiniMax, GPT-5.5) with real-time token tracking and pricing.

## Features

- **Model** — current model display name
- **Project + Git** — directory name, git branch, dirty indicator
- **Context window** — colored usage bar with percentage
- **Cache hit rate** — percentage + idle timer (time since last assistant response)
- **Platform balance** — real-time DeepSeek balance (¥), Kimi quota, MiniMax quota
- **Session cost** — calculated from transcript token usage (includes sub-agent tokens)

## Install

### Step 1: Add the marketplace

```
/plugin marketplace add illya317/cc-status
```

Registers `illya317/cc-status` as a plugin source. Claude Code clones the repo to `~/.claude/plugins/marketplaces/cc-status/`.

### Step 2: Install the plugin

```
/plugin install cc-status
```

Choose **Install for you (user scope)**. Copies the plugin into the cache and activates the `/cc-status:setup` command.

### Step 3: Reload

```
/reload-plugins
```

Loads the newly installed commands. You should see `1 skill` in the output.

### Step 4: Configure the status line

Add this to `~/.claude/settings.local.json`:

```json
"statusLine": {
  "type": "command",
  "command": "node ~/.claude/plugins/marketplaces/cc-status/dist/index.js",
  "padding": 0
}
```

Or run `/cc-status:setup` to do it automatically. Restart Claude Code and you'll see the status bar.

---

### Manual install

```bash
git clone https://github.com/illya317/cc-status.git ~/.claude/plugins/marketplaces/cc-status
```

Then add to `~/.claude/settings.local.json`:

```json
"statusLine": {
  "type": "command",
  "command": "node ~/.claude/plugins/marketplaces/cc-status/dist/index.js",
  "padding": 0
}
```

## Configuration

Edit `~/.claude/plugins/marketplaces/cc-status/config.json`:

| Key | Default | Description |
|-----|---------|-------------|
| `segments.model` | `true` | Show model name |
| `segments.project` | `true` | Show project dir + git |
| `segments.context` | `true` | Show context window bar |
| `segments.cache` | `true` | Show cache hit rate + idle timer |
| `segments.usage` | `true` | Show platform balance |
| `segments.cost` | `true` | Show session cost |
| `thresholds.cache_green` | `90` | Cache rate ≥ this → green |
| `thresholds.cache_yellow` | `80` | Cache rate ≥ this → yellow |
| `display.context_bar_width` | `5` | Context bar character width |
| `display.idle_cutoff_seconds` | `3600` | Hide idle timer after this |
| `display.cache_ttl_seconds` | `10` | Balance cache refresh interval |

## API Credentials

The plugin reads from these locations (first found wins):

1. `~/.claude/plugins/marketplaces/cc-status/.env`
2. `~/.env`
3. `$PWD/.env`

Copy `.env.example` to `.env` and fill in your keys. Both formats are supported:

```bash
# Plain
DEEPSEEK_API_KEY=sk-xxx

# Or shell-style
export DEEPSEEK_API_KEY=sk-xxx
```

Required keys:

| Key | For | How to get |
|-----|-----|------------|
| `DEEPSEEK_API_KEY` | DeepSeek balance | https://platform.deepseek.com → API keys |
| `KIMI_COOKIE` | Kimi quota | Browser: www.kimi.com → DevTools → Cookies → `access_token` |
| `MINIMAX_API_KEY` | MiniMax quota | https://platform.minimax.chat → API keys |

All keys are optional — missing keys simply skip that platform's balance display.

## Supported Models

| Model | Cache Hit | Cost | Balance |
|-------|-----------|------|---------|
| Claude (all) | ✓ | ✓ (stdin) | — |
| DeepSeek V4 Pro/Flash | ✓ | ✓ (promo) | ¥ balance |
| Kimi / K2.6 | ✓ | ✓ | quota bar |
| MiniMax M2.7 | ✓ | ✓ | quota bar |
| GPT-5.5 | ✓ | ✓ | — |

DeepSeek V4 Pro promotional pricing (2.5折) auto-detected until 2026-05-31.

## License

MIT
