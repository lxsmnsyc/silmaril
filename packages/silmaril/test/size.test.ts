import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { build } from 'tsdown';
import { expect, test } from 'vitest';

// The docs and the website state that the runtime ships under 1.5 kB gzipped.
const LIMIT = 1500;

test('the runtime stays under 1.5 kB minified and gzipped', async () => {
  const outDir = mkdtempSync(join(tmpdir(), 'silmaril-size-'));
  try {
    // Builds `silmaril` alone, minified, the way an app bundler would ship it.
    await build({
      config: false,
      entry: { index: 'src/index.ts' },
      format: 'esm',
      platform: 'neutral',
      minify: true,
      dts: false,
      sourcemap: false,
      outDir,
      logLevel: 'silent',
    });
    const size = gzipSync(readFileSync(join(outDir, 'index.js')), {
      level: 9,
    }).length;
    expect(size).toBeLessThan(LIMIT);
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
}, 30_000);
