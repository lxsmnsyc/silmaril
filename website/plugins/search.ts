/**
 * `virtual:search-index` exports the sections of every documentation page:
 * the page, the heading, its anchor and its text. The search box imports it
 * the first time someone types, so pages do not load it before.
 */
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import type { Plugin } from 'vite';
import { slug } from './markdown.ts';

export interface Entry {
  /** The path after `/docs/`. */
  page: string;
  pageTitle: string;
  heading: string;
  /** The anchor of the heading, empty for the top of the page. */
  id: string;
  text: string;
}

/** Plain text of Markdown, without code blocks, links and marks. */
function plain(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[`*_>#|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function entries(
  directories: string[],
  pages?: Set<string>,
): Promise<Entry[]> {
  const result: Entry[] = [];
  for (const directory of directories) {
    // oxlint-disable-next-line no-await-in-loop -- Two directories, read in order.
    const files = (await readdir(directory)).filter(
      (file) =>
        file.endsWith('.md') &&
        (!pages || pages.has(file.replace(/\.md$/, ''))),
    );
    // oxlint-disable-next-line no-await-in-loop -- Two directories, read in order.
    const sources = await Promise.all(
      files.map((file) => readFile(path.join(directory, file), 'utf8')),
    );
    files.forEach((file, index) => {
      const name = file.replace(/\.md$/, '');
      const page = name === 'index' ? '' : name;
      const sections = sources[index]!.split(/^(?=#{1,3} )/m);
      const pageTitle = /^# (.*)$/m.exec(sources[index]!)?.[1] ?? name;
      for (const section of sections) {
        const heading =
          /^#{1,3} (.*)$/m.exec(section)?.[1]?.replaceAll('`', '') ?? pageTitle;
        const level = /^(#{1,3}) /.exec(section)?.[1]?.length ?? 1;
        result.push({
          page,
          pageTitle,
          heading,
          id: level === 1 ? '' : slug(heading),
          text: plain(section.replace(/^#{1,3} .*$/m, '')).slice(0, 400),
        });
      }
    });
  }
  return result;
}

/**
 * `pages` limits the index to the documents of the site, by file name.
 */
export default function search(
  directories: string[],
  pages?: Set<string>,
  ID = 'virtual:search-index',
): Plugin {
  return {
    name: `website:search:${ID}`,
    resolveId(id) {
      // A request from the browser asks for the resolved ID itself.
      return id === ID || id === `\0${ID}` ? `\0${ID}` : null;
    },
    async load(id) {
      if (id !== `\0${ID}`) {
        return null;
      }
      for (const directory of directories) {
        this.addWatchFile(directory);
      }
      return `export const index = ${JSON.stringify(await entries(directories, pages))};`;
    },
  };
}
