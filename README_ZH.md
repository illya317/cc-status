🌐 [English](README.md) | [中文文档](README_ZH.md)

---

# cc-status

Claude Code HUD 插件 —— 单行状态栏，显示模型、缓存命中率、空闲计时、平台余额和会话费用。

支持 **Claude 官方模型** 和 **第三方模型**（DeepSeek、Kimi、MiniMax、GPT-5.5），实时 token 追踪与计费。

## 功能

- **模型** — 当前模型名称
- **项目 + Git** — 目录名、git 分支、脏状态
- **上下文窗口** — 彩色进度条 + 百分比
- **缓存命中率** — 百分比 + 空闲计时（距上次助手响应时间）
- **平台余额** — 实时 DeepSeek 余额（¥）、Kimi 配额、MiniMax 配额
- **会话费用** — 从 transcript 解析 token 用量计算（含子 Agent token）

## 安装

### 第一步：添加市场

```
/plugin marketplace add illya317/cc-status
```

注册 `illya317/cc-status` 为插件源。Claude Code 会将仓库 clone 到 `~/.claude/plugins/marketplaces/cc-status/`。

### 第二步：安装插件

```
/plugin install cc-status
```

选择 **Install for you (user scope)**。插件会被复制到缓存并激活 `/cc-status:setup` 命令。

### 第三步：重载

```
/reload-plugins
```

加载新安装的命令。输出中应看到 `1 skill`。

### 第四步：配置状态栏

运行 `/cc-status:setup` 自动配置，或在 `~/.claude/settings.local.json` 中添加：

```json
"statusLine": {
  "type": "command",
  "command": "node ~/.claude/plugins/marketplaces/cc-status/dist/index.js",
  "padding": 0
}
```

重启 Claude Code 后即可看到状态栏。

---

### 手动安装

```bash
git clone https://github.com/illya317/cc-status.git ~/.claude/plugins/marketplaces/cc-status
```

然后在 `~/.claude/settings.local.json` 添加：

```json
"statusLine": {
  "type": "command",
  "command": "node ~/.claude/plugins/marketplaces/cc-status/dist/index.js",
  "padding": 0
}
```

## 配置

编辑 `~/.claude/plugins/marketplaces/cc-status/config.json`：

| 键 | 默认值 | 说明 |
|-----|--------|------|
| `segments.model` | `true` | 显示模型名称 |
| `segments.project` | `true` | 显示项目目录 + git |
| `segments.context` | `true` | 显示上下文窗口条 |
| `segments.cache` | `true` | 显示缓存命中率 + 空闲计时 |
| `segments.usage` | `true` | 显示平台余额 |
| `segments.cost` | `true` | 显示会话费用 |
| `thresholds.cache_green` | `90` | 缓存率 ≥ 此值 → 绿色 |
| `thresholds.cache_yellow` | `80` | 缓存率 ≥ 此值 → 黄色 |
| `display.context_bar_width` | `5` | 上下文条字符宽度 |
| `display.idle_cutoff_seconds` | `3600` | 空闲计时超过此秒数隐藏 |
| `display.cache_ttl_seconds` | `10` | 余额缓存刷新间隔 |

## API 密钥

复制 `.env.example` 为 `.env` 并填入你的密钥。插件读取以下位置（先找到的生效）：

1. `~/.claude/plugins/marketplaces/cc-status/.env`
2. `~/.env`
3. `$PWD/.env`

两种格式都支持：

```bash
# 普通格式
DEEPSEEK_API_KEY=sk-xxx

# 或 shell 格式
export DEEPSEEK_API_KEY=sk-xxx
```

需要的密钥：

| 键 | 用途 | 获取方式 |
|-----|------|---------|
| `DEEPSEEK_API_KEY` | DeepSeek 余额 | https://platform.deepseek.com → API keys |
| `KIMI_COOKIE` | Kimi 配额 | 浏览器：www.kimi.com → DevTools → Cookies → `access_token` |
| `MINIMAX_API_KEY` | MiniMax 配额 | https://platform.minimax.chat → API keys |

所有密钥都是可选的 —— 缺哪个就跳过哪个平台的显示。

## 支持的模型

| 模型 | 缓存命中 | 费用 | 余额 |
|------|---------|------|------|
| Claude (全部) | ✓ | ✓ (stdin) | — |
| DeepSeek V4 Pro/Flash | ✓ | ✓ (促销价) | ¥ 余额 |
| Kimi / K2.6 | ✓ | ✓ | 配额条 |
| MiniMax M2.7 | ✓ | ✓ | 配额条 |
| GPT-5.5 | ✓ | ✓ | — |

DeepSeek V4 Pro 促销价（2.5折）自动检测，至 2026-05-31。

## 许可证

MIT
