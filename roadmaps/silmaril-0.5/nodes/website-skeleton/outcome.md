# Outcome: website-skeleton

## Built

- `website/`, a private workspace package (`pnpm-workspace.yaml` lists it) built with brumate 0.3.0, based on the website of brumate. It prerenders to static files in `website/dist/client`.
- Layout, header with a theme switch, sidebar, table of contents, previous and next links, search, link previews and a 404 page. Code highlighting uses twinkleplop (js, jsx, ts, tsx, css, json, bash).
- The README is split into 10 pages in `website/docs/*.md`: introduction (`index.md`), getting started, bundler setup, basic reactivity, computed variables, lifecycles, synchronous tracking, composition, stores, SolidJS. Every README section has a page. The sidebar order is in `website/src/docs.ts`.
- `website/vercel.json`: static output `dist/client`, clean URLs, an ignored build step (`website/scripts/vercel-ignore.sh`: `main` always builds, other branches only when they have an open pull request that changes `website/`), build command `pnpm --filter "website^..." build && pnpm build` (builds the `silmaril` workspace package first).
- `README.md` and `packages/silmaril/README.md` (still byte-identical) link to the `website` folder. They say the address goes there once the site is deployed.
- CI: a "Build website" step in `.github/workflows/ci.yml`.
- Scripts: `pnpm --filter website dev` (port 5180), `build`, `preview` (port 4180), `type-check` (`brumate-tsc`, so the root `pnpm type-check` covers it).
- `website` depends on `silmaril` as `workspace:*`, ready for `runnable-samples`. Nothing imports it yet.

### Where later nodes put things

- `docs-content`: add `website/docs/<name>.md` and list the name in `sections` in `website/src/docs.ts`. A page not listed there is built but not in the sidebar. Links between pages are written as `./name.md` and `./name.md#heading`. Alerts use GitHub syntax (`> [!NOTE]`). Pages are `docs/index.md` at `/docs`, others at `/docs/<name>`.
- `runnable-samples`: `website/plugins/markdown.ts` returns one `{ html }` part per page. brumate's site turns a fenced block marked `brm live` into a `{ files }` part and renders it with `src/components/LiveSample.brm` and `src/live/run.ts`. Add the same here: new part types in `PagePart`, a branch in the part loop of `src/components/DocPage.brm`, and a browser compile of samples with `silmaril/compiler`. The vite config will then need brumate's `features: 'all'` and the oxc WebAssembly aliases, as in brumate's `vite.config.ts`, and Vercel will need its COOP and COEP headers back if samples use threads.

## Deviations

- Not copied from the brumate site (they belong to `runnable-samples` or are brumate-only): the REPL, `@brumate/ui` and its pages and demos, live samples (`LiveSample.brm`, `src/live`, `check-samples`), the home page demos, `plugins/showcase.ts`, the network panel, `og.png` and the apple touch icon. Link previews use the plain `summary` card.
- `@brumate/ui` was not needed, so it was not installed or copied.
- The README links to the `website` folder on GitHub instead of a site address, because the address is not known until the user connects Vercel.
- The logo and brand mark are a placeholder gem shape, drawn for this node. Replace them when silmaril has a logo (`website/public/logo.svg`, `website/src/components/BrandMark.brm`).
- No changes to `.oxlintrc.json` or `.oxfmtrc.json`. `dist` is already ignored in both.

## Stubs left

- The page content is the README text as it is today. It still describes Babel and the 0.4 runtime. `docs-content` rewrites it, and the 0.5 switch changes the setup pages.
- The README link has no site address yet.
- No `og.png` or apple touch icon.

## Gotchas

- Published brumate 0.3.0 is older than brumate's `main`. Its website uses syntax that 0.3.0 rejects: `ref=$bind(x)` (use `ref=x`), and writing to a signal's DOM element in place gives a warning. `brumate-tsc` rejects the `{name}` attribute shorthand on components, so write `name=name`.
- `src/brumate-routes.d.ts` is rewritten by the build. oxlint warns about its empty `export {}` (a warning, not an error). Leave it alone.
- `website/dist` is build output and is ignored by git.
- `pnpm build` at the root only builds `packages/*`, so the website is not part of it. `pnpm --filter website build` needs `packages/silmaril` built first for `runnable-samples`; Vercel's build command handles that.
- The lockfile changed (222 packages from brumate, vite and twinkleplop). Nodes that touch it merge one at a time; the later one regenerates it after rebasing.
- Do not add `minimumReleaseAgeExclude`. All versions are pinned and older than the cutoff.

## Proposed learnings

- Pages are Markdown in `website/docs` and the sidebar order is in `website/src/docs.ts` | a page that is not listed does not show in the sidebar | website | no

## Verification

- `pnpm install --frozen-lockfile && pnpm build && pnpm test && pnpm type-check && pnpm lint && pnpm format:check && pnpm --filter website build`: passes. 20 tests pass, lint has 0 errors and 1 warning (generated file), the website prerenders 12 pages.
- Dev server (`node website/scripts/dev.ts`) answered 200 for `/`, `/docs`, `/docs/stores` and 404 for an unknown page.

## Vercel steps for the user

1. In Vercel, add a new project from `lxsmnsyc/silmaril`.
2. Set the root directory to `website`. Turn on "Include source files outside of the Root Directory", because the build needs `packages/silmaril`.
3. Leave the framework as Other. `vercel.json` sets the build command, output directory and clean URLs. Install runs `pnpm install` from the workspace root.
4. Use Node.js 24 in the project settings.
5. Deploy. `main` always deploys. A pull request gets a preview only when it changes `website/`; `vercel.json` runs `scripts/vercel-ignore.sh` as the ignored build step. A branch pushed before its pull request is opened gets no preview until the next push, because Vercel sets `VERCEL_GIT_PULL_REQUEST_ID` only when the pull request exists.
6. Optional: set `SITE_URL` (for example `https://silmaril.dev`) in the project environment if you use a custom domain. Without it, link previews use `VERCEL_PROJECT_PRODUCTION_URL`.
7. After the first deploy, put the site address into the line "Documentation: ..." in `README.md` and `packages/silmaril/README.md` (keep them identical).

## Size

- Estimated M, actual M.
