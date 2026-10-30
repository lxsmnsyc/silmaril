/**
 * Turns the Markdown files of the documentation into modules that export
 * their HTML, title and headings. Code blocks are highlighted with
 * twinkleplop. The HTML is a `raw` value, so markup inserts it as is.
 */
import { language as bash } from '@twinkleplop/bash';
import { language as css } from '@twinkleplop/css';
import { language as json } from '@twinkleplop/json';
import twinkleplop from '@twinkleplop/markdown-it';
import { language as tsx } from '@twinkleplop/tsx';
import { language as typescript } from '@twinkleplop/typescript';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import MarkdownIt from 'markdown-it';
import type { Plugin } from 'vite';

const REPOSITORY = 'https://github.com/lxsmnsyc/silmaril';

/** The pages of the site, from the files in `website/docs`. Links to other documents go to GitHub. */
export const SITE_PAGES: Set<string> = new Set(
  readdirSync(new URL('../docs/', import.meta.url))
    .filter((file) => file.endsWith('.md'))
    .map((file) => (file === 'index.md' ? '' : file.slice(0, -3))),
);

const RAW_MODULE = fileURLToPath(import.meta.resolve('brumate/html'));

export interface Heading {
  level: number;
  text: string;
  id: string;
}

/** A piece of a page: its HTML. Later pages add parts, such as samples that run in the page. */
export type PagePart = { html: unknown };

export interface Page {
  title: string;
  /** The first paragraph as plain text, for the description of the page in search results and link previews. */
  description: string;
  parts: PagePart[];
  headings: Heading[];
}

const LANGUAGES = {
  js: typescript(),
  javascript: 'js',
  jsx: tsx(),
  ts: typescript(),
  tsx: tsx(),
  css: css(),
  // SCSS and Less examples are close enough to CSS.
  scss: 'css',
  less: 'css',
  bash: bash(),
  json: json(),
};

/**
 * Code blocks take focus, so a keyboard can scroll one that is wider than the page, as WCAG
 * asks of a region that scrolls.
 */
function focusableCode(html: string): string {
  return html.replaceAll(
    '<pre class="twinkleplop',
    '<pre tabindex="0" class="twinkleplop',
  );
}

/** A heading id as GitHub makes it, so links between pages keep working. */
export function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s/g, '-');
}

/**
 * Points links between documents at the pages of the site, and links to the
 * rest of the repository at GitHub.
 */
function rewriteLink(href: string, base: string): string {
  const page = /^\.\/([\w-]+)\.md(#.*)?$/.exec(href);
  if (page) {
    const name = page[1] === 'index' ? '' : page[1]!;
    if (!SITE_PAGES.has(name)) {
      throw new Error(`Link to a page that is not on the site: ${href}`);
    }
    return `${base}docs${name ? `/${name}` : ''}${page[2] ?? ''}`;
  }
  if (href.startsWith('../')) {
    return `${REPOSITORY}/tree/main/${href.replace(/^(\.\.\/)+/, '')}`;
  }
  return href;
}

const ALERTS: Record<string, string> = {
  NOTE: 'Note',
  TIP: 'Tip',
  IMPORTANT: 'Important',
  WARNING: 'Warning',
  CAUTION: 'Caution',
};

/**
 * Renders GitHub alerts, a quote that starts with a line such as
 * `[!IMPORTANT]`, as `<div class="alert important">` with a title.
 */
function alerts(parser: MarkdownIt): void {
  // After `text_join`, so the marker is one text token.
  parser.core.ruler.push('alerts', (state) => {
    const { tokens } = state;
    for (let index = 0; index < tokens.length; index++) {
      const open = tokens[index]!;
      const inline = tokens[index + 2];
      if (open.type !== 'blockquote_open' || inline?.type !== 'inline') {
        continue;
      }
      const match = /^\[!(\w+)\]\s*(?:\n|$)/.exec(inline.content);
      const title = match && ALERTS[match[1]!.toUpperCase()];
      if (!match || !title) {
        continue;
      }
      const kind = match[1]!.toLowerCase();
      // Drops the marker and the line break after it.
      const children = inline.children ?? [];
      const first = children.findIndex((child) => child.type === 'text');
      if (first !== -1) {
        children[first]!.content = children[first]!.content.replace(
          /^\[!\w+\]\s*/,
          '',
        );
        if (
          !children[first]!.content &&
          children[first + 1]?.type === 'softbreak'
        ) {
          children.splice(first, 2);
        }
      }
      let depth = 0;
      for (let close = index; close < tokens.length; close++) {
        const token = tokens[close]!;
        if (token.type === 'blockquote_open') {
          depth++;
        } else if (token.type === 'blockquote_close' && --depth === 0) {
          token.tag = 'div';
          break;
        }
      }
      open.tag = 'div';
      open.attrSet('class', `alert ${kind}`);
      open.attrSet('role', 'note');
      const heading = new state.Token('html_block', '', 0);
      heading.content = `<p class="alert-title">${title}</p>\n`;
      tokens.splice(index + 1, 0, heading);
    }
  });
}

function createRenderer(base: string): MarkdownIt {
  const parser = new MarkdownIt({ html: false, linkify: false });
  parser.use(twinkleplop, {
    languages: LANGUAGES,
    on_unknown_language: 'plain',
  });
  parser.use(alerts);
  parser.renderer.rules.link_open = (tokens, index, options, _env, self) => {
    const token = tokens[index]!;
    const href = token.attrGet('href');
    if (href) {
      const rewritten = rewriteLink(href, base);
      token.attrSet('href', rewritten);
      if (rewritten.startsWith('http')) {
        token.attrSet('target', '_blank');
        token.attrSet('rel', 'noreferrer');
      }
    }
    return self.renderToken(tokens, index, options);
  };
  parser.renderer.rules.heading_open = (
    tokens,
    index,
    options,
    env: { headings: Heading[] },
    self,
  ) => {
    const token = tokens[index]!;
    const text = tokens[index + 1]?.content ?? '';
    const id = slug(text);
    token.attrSet('id', id);
    env.headings.push({
      level: Number(token.tag.slice(1)),
      text: text.replaceAll('`', ''),
      id,
    });
    return self.renderToken(tokens, index, options);
  };
  return parser;
}

/** The text of the first paragraph, without markup, cut at about 160 characters. */
function summary(
  tokens: {
    type: string;
    content: string;
    children: { content: string }[] | null;
  }[],
): string {
  const index = tokens.findIndex((token) => token.type === 'paragraph_open');
  const inline = index === -1 ? undefined : tokens[index + 1];
  const text = (inline?.children ?? [])
    .map((child) => child.content)
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= 160) {
    return text;
  }
  const cut = text.slice(0, 157);
  return `${cut.slice(0, cut.lastIndexOf(' '))}…`;
}

/** Compiles `.md` imports into pages. */
export default function markdown(): Plugin {
  let base = '/';
  return {
    name: 'website:markdown',
    configResolved(config) {
      base = config.base;
    },
    transform(code, id) {
      if (!id.endsWith('.md')) {
        return null;
      }
      const env = { headings: [] as Heading[] };
      const parser = createRenderer(base);
      const tokens = parser.parse(code, env);
      const html = focusableCode(
        parser.renderer.render(tokens, parser.options, env),
      );
      const parts = [`{ html: raw(${JSON.stringify(html)}) }`];
      const title =
        env.headings.find((heading) => heading.level === 1)?.text ?? '';
      const description = summary(tokens);
      return {
        code: [
          // Resolved from the site, because some documents are outside it.
          `import { raw } from ${JSON.stringify(RAW_MODULE)};`,
          `export default { title: ${JSON.stringify(title)}, description: ${JSON.stringify(description)}, headings: ${JSON.stringify(env.headings)}, parts: [${parts.join(', ')}] };`,
        ].join('\n'),
        map: null,
      };
    },
  };
}
