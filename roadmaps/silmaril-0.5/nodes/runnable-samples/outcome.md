# Outcome: runnable-samples

## Built

- `website/src/live/run.ts`: `compileSample`, `runModule`, `runSample`. It calls `ready()` and `compile()` from `silmaril/compiler` (oxc wasm binding in the browser), rewrites `silmaril` and `silmaril/store` imports to shim modules over the runtime, loads the module from a blob URL (data URL in Node.js) and sends `console` calls to a log list. The page and the check share it.
- `website/src/components/LiveSample.brm`: source in an editable textarea, Run button, Logs and Compiled tabs, compile errors with the code frame. It runs on load and 400 ms after typing stops.
- `website/plugins/markdown.ts`: a fenced block marked `live` (`js live`, or `js live counter.js` with an empty body to read `website/src/samples/counter.js`) becomes a `{ sample }` part (`PagePart` extended). `DocPage.brm` renders it with `LiveSample`.
- `website/scripts/check-samples.ts` and `pnpm --filter website check:samples`: compiles and runs every live fence in `website/docs/*.md` and every file in `website/src/samples/`.
- Demo samples: `counter.js` (shown on the home page in place of the static block) and `computed.js` (checked, not shown).
- `website/vite.config.ts`: `optimizeDeps.exclude` for `oxc-parser` and the binding. `pnpm-workspace.yaml`: override `@napi-rs/wasm-runtime: 1.2.5`.
- CI: a "Check website samples" step in `.github/workflows/ci.yml`. It runs in about a second, needs no browser, and runs after the build.

## Run mode until codegen lands

Compile and load check only. `silmaril/compiler` returns its input unchanged and `$` throws when it is not compiled, so a sample whose output equals its input is compiled (errors are reported) and not run. The page says "Compiled, not run"; `check:samples` counts these ("2 compiled only"). Once codegen emits code, the same path runs the module and shows logs, with no change here. The 0.4 Babel pipeline in the browser was not tried (heavy). Run, shim and log paths were tested in Node.js with a hand-written module; the v2 fixtures cannot load until `runtime-v2` merges.

## Deviations

- Acceptance "after switch-to-v2, every sample runs on the 0.5 pipeline" is not met yet, as expected.
- No `features: 'all'` or COOP/COEP headers: the silmaril runner does not compile brumate components or use threads (the wasip1 binding is not threaded).
- The editor is a plain textarea, with no highlighting while editing. Samples are JS only (`js`, `jsx`; no type stripping).
- Edited `website/src/routes/index.brm` (outside the listed paths) to put the demo on the home page, so `docs-content` prose is untouched. Orchestrator: move it if the home page belongs to another node.
- Added `@oxc-parser/binding-wasm32-wasip1: 0.155.0` as a website dependency (the brief names it).

## Stubs left

- No expected-log assertions; `check:samples` only requires that a sample compiles and runs without throwing. Add them when codegen lands (a `// logs:` comment or a sidecar file).
- The check of the sample page in a browser was manual (Chrome against `preview`), not automated.

## Gotchas

- A live fence needs `silmaril` imports only from `silmaril` or `silmaril/store`; other imports throw.
- The sample shadows `console` with a module-level `const`, so a sample that declares `console` breaks.
- `check:samples` needs `packages/silmaril` built first (it imports `silmaril/compiler` from `dist`).
- After `benchmark-harness` merges: rebase and regenerate `pnpm-lock.yaml` (`pnpm install`).

## Proposed learnings

- Run samples with the same module as the page | the check then runs what readers see | `website/` | yes (`check:samples`)

## Verification

- `pnpm install --frozen-lockfile && pnpm build && pnpm test && pnpm type-check && pnpm lint`: pass (358 tests; lint clean).
- `pnpm format:check`: pass. `pnpm --filter website build`: 12 pages prerendered, wasm asset emitted.
- `pnpm --filter website check:samples`: 2 samples, 0 problems, 2 compiled only.
- Chrome on `website preview`: wasm compile loads, the home page sample shows "Compiled, not run".

## Size

- Estimated M, actual M.
