import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

// The OpenAI CUA runtime's tab.screenshot() ignores its `path` argument and
// returns the raw image bytes (a JSON object with sequential numeric keys).
// These helpers recover that payload from the js tool result and persist it
// so callers get a real file on disk.

const BLOB_PATTERN = /\{"0":\d{1,3}(?:,"\d+":\d{1,3}){1023,}\}/;

export function extractScreenshotPath(code) {
  if (typeof code !== 'string' || !code.includes('screenshot')) return null;
  const match = code.match(/\.screenshot\(\s*\{[^}]*path\s*:\s*["']([^"']+)["']/);
  return match?.[1] ?? null;
}

function bytesFromObject(obj) {
  const keys = Object.keys(obj);
  if (keys.length < 1024) return null;
  for (let i = 0; i < keys.length; i += 1) {
    if (keys[i] !== String(i)) return null;
    const value = obj[keys[i]];
    if (!Number.isInteger(value) || value < 0 || value > 255) return null;
  }
  const [b0, b1, b2] = [obj['0'], obj['1'], obj['2']];
  const isJpeg = b0 === 0xff && b1 === 0xd8 && b2 === 0xff;
  const isPng = b0 === 0x89 && b1 === 0x50;
  if (!isJpeg && !isPng) return null;
  return { bytes: Buffer.from(keys.map(key => obj[key])), ext: isJpeg ? '.jpg' : '.png' };
}

export function extractImageBytes(text) {
  if (typeof text !== 'string') return null;
  try {
    const direct = bytesFromObject(JSON.parse(text));
    if (direct) return direct;
  } catch {
    // Not pure JSON — fall through to substring search.
  }
  const match = text.match(BLOB_PATTERN);
  if (!match) return null;
  try {
    return bytesFromObject(JSON.parse(match[0]));
  } catch {
    return null;
  }
}

export async function saveScreenshot(path, bytes) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, bytes);
}
