#!/usr/bin/env node
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import os from 'node:os';
import { ChildMcp } from './child-mcp.mjs';
import { resolveOpenAiRuntime } from './runtime-resolver.mjs';

function turnMetadata(sessionId, turnId) {
  return {
    'x-codex-turn-metadata': JSON.stringify({
      session_id: sessionId,
      turn_id: turnId,
      thread_source: 'user',
      model: 'none',
    }),
  };
}

const runtime = await resolveOpenAiRuntime();
const runtimeDir = await mkdtemp(join(os.tmpdir(), 'openai-chrome-probe-'));
const sessionId = `claude-openai-chrome-probe-${process.pid}`;
const turnId = `probe-${Date.now()}`;
const meta = turnMetadata(sessionId, turnId);
let child;

function textOf(result) {
  return (result?.content ?? [])
    .filter(item => item.type === 'text')
    .map(item => item.text)
    .join('\n');
}

try {
  child = new ChildMcp({
    runtime,
    runtimeDir,
    onRequest: async request => {
      if (request.method === 'elicitation/create') {
        throw new Error('Read-only compatibility probe does not approve browser actions');
      }
      if (request.method === 'roots/list') return { roots: [] };
      throw new Error(`Unsupported child request during probe: ${request.method}`);
    },
  });
  await child.start();

  const bootstrap = await child.tool('js', {
    title: 'Initialize OpenAI Chrome probe',
    code: `const { setupBrowserRuntime } = await import(${JSON.stringify(runtime.paths.browserClient)}); const agent = await setupBrowserRuntime(); const chrome = await agent.browsers.get("chrome"); console.log(JSON.stringify({browserId: chrome.browserId, tabs: await chrome.user.openTabs()}));`,
    timeout_ms: 30000,
  }, meta, 60000);

  const output = textOf(bootstrap);
  const marker = output.split('\n').find(line => line.trim().startsWith('{') && line.includes('browserId'));
  if (!marker) throw new Error(`Chrome discovery returned no browser result. Output: ${output}`);
  const browser = JSON.parse(marker);

  await child.tool('turn_ended', {
    hook_event_name: 'Stop',
    session_id: sessionId,
    turn_id: turnId,
  }, meta, 30000);

  console.log(JSON.stringify({
    ok: true,
    runtime: {
      appVersion: runtime.appVersion,
      pluginVersion: runtime.pluginVersion,
      hashes: runtime.hashes,
    },
    browser: {
      connected: true,
      id: browser.browserId,
      tabCount: Array.isArray(browser.tabs) ? browser.tabs.length : 0,
    },
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    runtime: {
      appVersion: runtime.appVersion,
      pluginVersion: runtime.pluginVersion,
      hashes: runtime.hashes,
    },
    error: error?.message ?? String(error),
    note: 'No private-socket, signing, extension, or manifest bypass was attempted.',
  }, null, 2));
  process.exitCode = 1;
} finally {
  await child?.stop().catch(() => {});
  await rm(runtimeDir, { recursive: true, force: true });
}
