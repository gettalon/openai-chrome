import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const bundle = join(root, 'skills', 'openai-chrome');

async function json(path) {
  return JSON.parse(await readFile(join(root, path), 'utf8'));
}

test('bundle contains one valid skill and its MCP server', async () => {
  const skill = await readFile(join(bundle, 'SKILL.md'), 'utf8');
  assert.match(skill, /^---\nname: openai-chrome\ndescription: .+\n---/);
  const mcp = await json('skills/openai-chrome/.mcp.json');
  assert.equal(mcp.mcpServers['openai-chrome'].command, 'node');
  assert.deepEqual(mcp.mcpServers['openai-chrome'].args, ['${CLAUDE_PLUGIN_ROOT}/scripts/proxy-server.mjs']);
});

test('plugin metadata is portable and points at the bundle skill', async () => {
  const plugin = await json('skills/openai-chrome/.claude-plugin/plugin.json');
  assert.equal(plugin.name, 'openai-chrome');
  assert.equal(plugin.version, '0.1.0');
  assert.deepEqual(plugin.skills, ['./']);
  assert.doesNotMatch(JSON.stringify(plugin), /@|\/Users\//);
});

test('evals and scripts contain no local-only paths', async () => {
  const files = ['evals/evals.json', 'tests/proxy-live.py', 'skills/openai-chrome/SKILL.md'];
  for (const file of files) {
    const text = await readFile(join(root, file), 'utf8');
    assert.doesNotMatch(text, /\/Users\/hunter|iclass\.one/);
  }
});
