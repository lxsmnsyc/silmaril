/**
 * `virtual:runtime-size` exports the size of the `silmaril` runtime in bytes, minified and
 * gzipped, measured from the built package when the site builds. The landing page shows it, so
 * the number is never typed by hand. `packages/silmaril/test/size.test.ts` measures the same.
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { minify, type Plugin } from 'vite';

const ID = 'virtual:runtime-size';
const RESOLVED = `\0${ID}`;

export default function runtimeSize(): Plugin {
  return {
    name: 'silmaril-website:runtime-size',
    resolveId(id) {
      return id === ID ? RESOLVED : null;
    },
    async load(id) {
      if (id !== RESOLVED) {
        return null;
      }
      const file = fileURLToPath(import.meta.resolve('silmaril'));
      this.addWatchFile(file);
      const { code } = await minify(
        'index.mjs',
        await readFile(file, 'utf8'),
        {},
      );
      const bytes = gzipSync(code, { level: 9 }).length;
      return `export default ${bytes};`;
    },
  };
}
