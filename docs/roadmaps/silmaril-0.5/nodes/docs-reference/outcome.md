# Outcome: docs-reference

## Built

- `website/docs/getting-started.md`: requirements, install, `silmaril.vite()` in `vite.config.js`, a first example (live `counter.js`), next steps. No Babel.
- `website/docs/bundler-setup.md`: Vite, Rollup, the other unplugin members, the options (`filter.include`, `filter.exclude`), how ids with queries are named, the deprecated Rollup and Vite packages, and the browser compiler setup (wasm binding at the `oxc-parser` version, `@napi-rs/wasm-runtime` pinned to 1.2.5, Vite `optimizeDeps.exclude`, top-level await target, `ready()`).
- `website/docs/api.md`: every export of `silmaril`, `silmaril/store`, `silmaril/solid`, `silmaril/compiler` and `silmaril/unplugin` with signature and short example. Runtime helper functions (`$$root`, `$$set` and the rest) are listed as compiler targets, not for direct use.
- `website/scripts/expected-api.ts` and one `Object.assign` line in `website/scripts/check-samples.ts` (shared file) assert the sample logs.
- `website/src/docs.ts`: `api` in the Start section, labeled `API reference`.
- Samples: `website/src/samples/api-skip.js`, `api-store.js`, `api-tick.js` (live in `api.md`).

## Deviations

- The getting-started page links only to pages that exist now (bundler setup, basic reactivity, API reference). The migration page is `docs-migration`'s.
- `docs/` pages for the Guide still hold 0.4 text; they are not in this node.

## Stubs left

- None.

## Gotchas

- `Store` from `silmaril/store` passes the new value to listeners, but its `.d.ts` types `subscribe(callback: () => void)`. The API page follows the `.d.ts`.
- The logs of the `api-*` samples are asserted in `website/scripts/expected-api.ts`, merged into `EXPECTED` by one line in `check-samples.ts`.

## Proposed learnings

- Check API signatures against the built `.d.mts` with a script | prose drifts from types | `website/docs/api.md` | yes

## Verification

- Signatures: `pnpm build`, then a script that strips `export`/`declare`, comments, trailing commas and whitespace from each top-level statement in `packages/silmaril/dist/*.d.mts` and searches for it in `api.md`. All match except four deliberate differences: `Scope` fields are elided, `Fn` is written out in `$$memo`, `$$sync` and `$$effect`, and `SourceLocation` is written as an interface (checked by hand).
- `pnpm --filter website build`: passes.
- `pnpm --filter website check:samples --strict`: 5 samples, 0 problems, 0 compiled and not run.
- `pnpm format:check`: passes. Prose checker `check_prose.py` on the three pages: clean.

## Size

- Estimated M, actual M.
