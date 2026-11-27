/**
 * Writes the pages for agents into the client build:
 *
 * - `docs/<page>.md` (`docs/index.md` for the introduction) holds the Markdown of each page, with
 *   the source of each live sample in its block.
 * - `llms.txt` lists those files by section, as https://llmstxt.org describes.
 * - `llms-full.txt` joins every page in sidebar order.
 */
import { readFileSync } from 'node:fs';
import type { Plugin } from 'vite';
import { SECTIONS } from '../src/sections.ts';

const DOCS = new URL('../docs/', import.meta.url);
const SAMPLES = new URL('../src/samples/', import.meta.url);

/** The Markdown of a page, with each empty `js live <file>` block filled from its sample. */
function readPage(page: string): string {
  const markdown = readFileSync(new URL(`${page || 'index'}.md`, DOCS), 'utf8');
  return markdown.replace(
    /^```js live (\S+)\n\s*```$/gm,
    (_, file: string) =>
      `\`\`\`js\n${readFileSync(new URL(file, SAMPLES), 'utf8').trimEnd()}\n\`\`\``,
  );
}

/** The title and the first sentence of a page. */
function describe(markdown: string): { title: string; summary: string } {
  const title = /^# (.+)$/m.exec(markdown)?.[1] ?? '';
  const body = markdown.slice(
    markdown.indexOf('\n', markdown.indexOf('# ')) + 1,
  );
  const paragraph = body
    .trim()
    .split(/\n\s*\n/)[0]!
    .replace(/\s+/g, ' ');
  const summary = /^.*?\.(?=\s|$)/.exec(paragraph)?.[0] ?? paragraph;
  return { title, summary };
}

export default function llms(siteUrl: string): Plugin {
  let base = '/';
  return {
    name: 'silmaril-website:llms',
    apply: 'build',
    configResolved(config) {
      base = config.base;
    },
    generateBundle() {
      // The SSR build writes no public files.
      if (this.environment.name !== 'client') {
        return;
      }
      const lines = [
        '# silmaril',
        '',
        `> ${describe(readPage('')).summary}`,
        '',
      ];
      const full: string[] = [];
      for (const section of SECTIONS) {
        lines.push(`## ${section.title}`, '');
        for (const page of section.pages) {
          const markdown = readPage(page);
          const fileName = `docs/${page || 'index'}.md`;
          this.emitFile({ type: 'asset', fileName, source: markdown });
          full.push(markdown.trimEnd());
          const { title, summary } = describe(markdown);
          lines.push(`- [${title}](${siteUrl}${base}${fileName}): ${summary}`);
        }
        lines.push('');
      }
      this.emitFile({
        type: 'asset',
        fileName: 'llms.txt',
        source: lines.join('\n'),
      });
      this.emitFile({
        type: 'asset',
        fileName: 'llms-full.txt',
        source: `${full.join('\n\n')}\n`,
      });
    },
  };
}
