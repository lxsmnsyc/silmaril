/**
 * Code for the landing page, made at build time so the highlighter does not ship:
 *
 * - `import code from './file.js?highlight'` gives the source of a file and its HTML.
 * - `import code from './file.js?compiled'` gives what `silmaril/compiler` makes of the file,
 *   and its HTML, so the page shows the real output.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { language as typescript } from '@twinkleplop/typescript';
import { compile } from 'silmaril/compiler';
import type { Plugin } from 'vite';

const QUERY = /\?(highlight|compiled)$/;

export default function highlight(): Plugin {
  const javascript = typescript();
  return {
    name: 'silmaril-website:highlight',
    enforce: 'pre',
    async load(id) {
      const match = QUERY.exec(id);
      if (!match) {
        return null;
      }
      const file = id.slice(0, match.index);
      this.addWatchFile(file);
      let source = (await readFile(file, 'utf8')).trimEnd();
      if (match[1] === 'compiled') {
        source = compile(source, {
          filename: path.basename(file),
          sourcemap: false,
        }).code.trimEnd();
      }
      return `export default ${JSON.stringify({ source, html: javascript(source) })};`;
    },
  };
}
