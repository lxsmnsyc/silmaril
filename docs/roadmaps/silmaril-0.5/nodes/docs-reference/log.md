# Log: docs-reference

- 2026-10-30: Nothing existed yet except the Babel-era getting-started and bundler-setup pages.
- Rewrote `getting-started.md` (Vite, `silmaril.vite()`, live `counter.js` sample) and `bundler-setup.md` (Vite, Rollup, other bundlers, options, query ids, deprecated packages, browser compiler setup).
- Added `api.md` (all five subpaths) and added `api` to the sidebar in `website/src/docs.ts`.
- New samples: `api-skip.js`, `api-store.js`, `api-tick.js`.
- Signatures checked with a script that normalizes each statement in `packages/silmaril/dist/*.d.mts` and looks for it in `api.md`.
- `Store` class listeners receive the new value at run time although the `.d.ts` types the callback as `() => void`. The page follows the `.d.ts` and says the value is passed.
- Review fixes: `$` first run described as a microtask flush, `$composable` named as an exception, `api-skip.js` rewritten so `b` is written alone after `tick()`, logs of the three `api-*` samples asserted through `website/scripts/expected-api.ts`, Store interface documented as the custom-store contract, Rollup order advice relaxed, `vite` and `index.html` added to getting started, 0.4 and Babel mentions removed, `{ts,tsx}` include note, microtask rethrow of `$` errors.
