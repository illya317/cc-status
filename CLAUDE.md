# cc-status

Claude Code status-line plugin. Reads stdin JSON, outputs a colored single-line status bar.

## Files

- `dist/index.js` — entry point: reads stdin, orchestrates, outputs status line
- `dist/config.js` — loads config.json with defaults
- `dist/transcript.js` — parses JSONL transcript for token usage and idle time
- `dist/pricing.js` — model pricing tables and cost calculation
- `dist/platform.js` — DeepSeek/Kimi/MiniMax balance API queries with caching
- `dist/cache.js` — file-based JSON cache at ~/.claude/.cc-status-cache.json
- `dist/git.js` — git branch and dirty status
- `dist/render.js` — ANSI rendering, segments, color palette
- `config.json` — user configuration (segment toggles, thresholds, display options)

## Commands

- `/cc-status:setup` — configure statusLine in settings.json

## Config

`~/.claude/plugins/marketplaces/cc-status/config.json` — edit to toggle segments or adjust thresholds.

## Env

API credentials from `~/.env` (shell-style `export KEY=VALUE` or plain `KEY=VALUE`):
- `DEEPSEEK_API_KEY` — DeepSeek balance
- `KIMI_COOKIE` — Kimi quota
- `MINIMAX_API_KEY` — MiniMax quota
