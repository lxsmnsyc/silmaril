import { fileURLToPath } from 'node:url';
import brumate from 'brumate/vite';
import { defineConfig } from 'vite';
import markdown, { SITE_PAGES } from './plugins/markdown.ts';
import search from './plugins/search.ts';

/**
 * The address of the site, for link previews, which need absolute URLs. `SITE_URL` sets it.
 * On Vercel it is the production domain of the project.
 */
const siteUrl = (
  process.env.SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'http://localhost:5180')
).replace(/\/$/, '');

export default defineConfig({
  // `BASE` is the path the site is served from, such as `/silmaril/`.
  base: process.env.BASE ?? '/',
  define: {
    'import.meta.env.SITE_URL': JSON.stringify(siteUrl),
  },
  plugins: [
    markdown(),
    search(
      [fileURLToPath(new URL('docs', import.meta.url))],
      new Set([...SITE_PAGES].map((page) => page || 'index')),
    ),
    // Every page is written as a static file.
    brumate({
      navigate: { transition: true },
      prerender: { paths: ['/'] },
    }),
  ],
  build: {
    target: 'es2023',
    // The prerender script reads the manifest to find the built client entry.
    manifest: true,
    rolldownOptions: {
      input: 'src/client.ts',
    },
  },
});
