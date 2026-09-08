# openai-chrome

Unofficial Claude Code bridge for an already-installed OpenAI Chrome CUA runtime. Not affiliated with, endorsed by, or distributed by OpenAI or Anthropic.

> Security note: this is privileged browser automation. Installing the skill also installs an auto-discovered Claude Code plugin and local MCP server that can observe and act in your authenticated Chrome profile. Review the source and `SECURITY.md` before installing.

## Prerequisites

- macOS with Node.js 22.20 or newer.
- Current Claude Code.
- A separately installed and initialized ChatGPT/Codex desktop runtime, with the ChatGPT-for-Chrome extension enabled in the selected Chrome profile.
- The OpenAI native-host registry, normally `~/.codex/chrome-native-hosts-v2.json` or under `$CODEX_HOME`.

Compatibility currently targets the production v2 registry/protocol and may break when the separately installed OpenAI runtime changes.

## Installation

```bash
npx skills add TedWei/openai-chrome
```

Recommended explicit global install for Claude Code:

```bash
npx skills add TedWei/openai-chrome -g -a claude-code --skill openai-chrome
```

Then restart Claude Code or reload plugins and confirm `openai-chrome@skills-dir` is visible. What gets installed is the self-contained `skills/openai-chrome/` bundle, including `SKILL.md`, `.claude-plugin/plugin.json`, `.mcp.json`, and `scripts/`.

## Usage

Ask for OpenAI Chrome explicitly, for example:

- "Use OpenAI Chrome to open `https://example.com` and screenshot the homepage."
- "Use my logged-in Chrome tab to inspect the dashboard, read only."
- "Use OpenAI Chrome to click through the signup flow, asking before every submit."

Read-only inspection does not require confirmation. Deleting data, posting, purchasing, changing credentials/permissions, transmitting sensitive data, CAPTCHAs, installs, medical actions, and system/security changes require explicit action-time confirmation.

## Architecture

1. The Skills CLI copies `skills/openai-chrome/` into the agent skill directory.
2. Claude Code discovers the installed `.claude-plugin/plugin.json` as `openai-chrome@skills-dir`.
3. `.mcp.json` starts the local `scripts/proxy-server.mjs` MCP server.
4. `runtime-resolver.mjs` reads the existing OpenAI native-host registry.
5. `child-mcp.mjs` launches the existing signed Codex sandbox/runtime.
6. No second model or `codex exec` is used.

## Data and privacy

This repository adds no telemetry. Browser data remains subject to Claude Code, the local bridge, the installed OpenAI runtime, Chrome, and visited websites. The repository does not contain or upload browser profiles, registry contents, or runtime code.

## Troubleshooting and diagnostic probe

Run the read-only installed probe if Chrome cannot connect:

```sh
node ~/.claude/skills/openai-chrome/scripts/probe.mjs
```

It reports compatibility versions, connection status, and tab count without approving browser mutations. Ensure the ChatGPT app is running and the ChatGPT-for-Chrome extension is enabled in the selected profile. Never patch sockets, extensions, manifests, signing, or permissions.

## Development and offline validation

```bash
npm ci
npm test
npx --no-install claude plugin validate ./skills/openai-chrome --strict
npx --no-install skills add . --list
```

The live probe and `tests/proxy-live.py` are opt-in and require the installed OpenAI runtime:

```bash
npm run probe
npm run test:live
```

## Uninstall

```bash
npx skills remove openai-chrome
```

## License and third-party boundary

MIT for this wrapper only; see `LICENSE`. ChatGPT/Codex applications, OpenAI's Chrome extension and native host, browser client/service code, Node REPL runtime files, generated files, and Google Chrome are not included, redistributed, or licensed here.
