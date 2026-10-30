// The pages of the documentation, from the Markdown files in `website/docs`.

import type { Page } from '../plugins/markdown.ts';

export type { Page };

const files = import.meta.glob<Page>('../docs/*.md', {
  eager: true,
  import: 'default',
});

/**
 * The pages, by their path after `/docs/`. The map has no prototype, so a path such as
 * `constructor` is not a page.
 */
export const pages: Record<string, Page> = Object.create(null);
for (const [file, page] of Object.entries(files)) {
  const name = /([\w-]+)\.md$/.exec(file)![1]!;
  pages[name === 'index' ? '' : name] = page;
}

/** Shorter names for the sidebar, where the title of a page is long. */
const labels: Record<string, string> = {
  'bundler-setup': 'Bundler setup',
  'basic-reactivity': 'Basic reactivity',
  'computed-variables': 'Computed variables',
  'synchronous-tracking': 'Synchronous tracking',
  migration: 'Migrating from 0.4',
};

/** The sections of the sidebar, in reading order. */
export const sections: {
  title: string;
  pages: { slug: string; title: string }[];
}[] = [
  { title: 'Start', pages: ['', 'getting-started', 'bundler-setup'] },
  {
    title: 'Guide',
    pages: [
      'basic-reactivity',
      'computed-variables',
      'lifecycles',
      'synchronous-tracking',
      'composition',
    ],
  },
  { title: 'Integrations', pages: ['stores', 'solid'] },
  { title: 'More', pages: ['migration', 'internals', 'limits'] },
].map((section) => ({
  title: section.title,
  pages: section.pages
    .filter((slug) => slug in pages)
    .map((slug) => ({
      slug,
      title:
        slug === '' ? 'Introduction' : (labels[slug] ?? pages[slug]!.title),
    })),
}));
