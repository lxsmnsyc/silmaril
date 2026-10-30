# silmaril website

The documentation of silmaril, built with [brumate](https://github.com/lxsmnsyc/brumate). The layout follows the website of brumate.

- The pages are Markdown files in [`docs`](./docs). [`plugins/markdown.ts`](./plugins/markdown.ts) renders them with markdown-it and highlights code with twinkleplop at build time. [`src/docs.ts`](./src/docs.ts) orders them in the sidebar.
- To add a page, add `docs/<name>.md` and list `<name>` in a section of [`src/docs.ts`](./src/docs.ts). The URL is `/docs/<name>`.
- The routes are in [`src/routes`](./src/routes). The build renders each one to a static HTML file with the `prerender` option of the brumate plugin, so the site needs no server.
- [`plugins/search.ts`](./plugins/search.ts) builds the search index from the pages.
- The site uses the `silmaril` package of this workspace.

Run it from the root of the repository:

```bash
pnpm install
pnpm build
pnpm --filter website dev
```

`pnpm --filter website build` writes the static site to `dist/client`, and `pnpm --filter website preview` serves it. Set `BASE` when the site is served from a subpath, and `SITE_URL` for the address in link previews.
