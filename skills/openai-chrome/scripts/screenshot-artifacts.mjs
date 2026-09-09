import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

// The OpenAI CUA runtime returns binary payloads as raw byte objects
// (JSON with sequential numeric keys) instead of writing files:
//   - tab.screenshot({fullPage, clip}) / elementScreenshot(...) -> Uint8Array
//   - tab.getScreenshot() / getAXStateAndScreenshot() -> Uint8Array
//   - getTabContext() binaries arrive as {data, fileName, mimeType}
// None of these accept a `path` argument, so a `{ path }` convention is
// honored when present and a timestamped tmp file is used otherwise.
// Persisting here also keeps ~1MB blobs out of the model context.

const BLOB_PATTERN = /\{"0":\d{1,3}(?:,"\d+":\d{1,3}){1023,}\}/;
const MIN_BLOB_KEYS = 1024;

export function extractScreenshotPath(code) {
  if (typeof code !== 'string' || !/screen\s*shot/i.test(code)) return null;
  const match = code.match(
    /\.(?:screen|elementScreen|get(?:AXStateAnd)?Screen)shot\(\s*\{[^}]*path\s*:\s*["']([^"']+)["']/i,
  );
  return match?.[1] ?? null;
}

function bytesFromObject(obj) {
  const keys = Object.keys(obj);
  if (keys.length < MIN_BLOB_KEYS) return null;
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

export function defaultArtifactPath(ext) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return join(tmpdir(), `openai-chrome-${stamp}${ext}`);
}

export async function saveScreenshot(path, bytes) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, bytes);
}
