# Outcome: runnable-samples

## Built

- `website/src/live/run.ts`: `compileSample`, `runModule`, `runSample`. It calls `ready()` and `compile()` from `silmaril/compiler` (oxc wasm binding in the browser), rewrites `silmaril` and `silmaril/store` imports to shim modules over the runtime, loads the module from a blob URL (data URL in Node.js) and sends `console` calls to a log list. The page and the check share it.
- `website/src/components/LiveSample.brm`: source in an editable textarea, Run button, Logs and Compiled tabs, compile errors with the code frame. It runs on load and 400 ms after typing stops.
- `website/plugins/markdown.ts`: a fenced block marked `live` (`js live`, or `js live counter.js` with an empty body to read `website/src/samples/counter.js`) becomes a `{ sample }` part (`PagePart` extended). `DocPage.brm` renders it with `LiveSample`.
- `website/scripts/check-samples.ts` and `pnpm --filter website check:samples`: compiles and runs every live fence in `website/docs/*.md` and every file in `website/src/samples/`.
- Demo samples: `counter.js` (shown on the home page in place of the static block) and `computed.js` (checked, not shown).
- `website/vite.config.ts`: `optimizeDeps.exclude` for `oxc-parser` and the binding. `pnpm-workspace.yaml`: override `@napi-rs/wasm-runtime: 1.2.5`.
- CI: a "Check website samples" step in `.github/workflows/ci.yml`. It runs in about a second, needs no browser, and runs after the build.

## Run mode

Samples run on the 0.5 pipeline. `silmaril/compiler` emits v2 code (`codegen-core`), and `MODULES` in `website/src/live/run.ts` points `silmaril` at the v2 runtime by a relative source import of `packages/silmaril/src/v2/index.ts` (the package does not export it). `silmaril/store` stays the real store entry; v2 takes store objects and does not import it. `check:samples` runs both demo samples and asserts their logs (`Count: 100`, `21 doubled is 42`, kept in `EXPECTED` in `check-samples.ts`); other samples are only checked to run. CI runs it with `--strict`, which fails on a sample compiled and not run.

`switch-to-v2` still has to: change the import in `run.ts` to `silmaril` once the package exports the v2 runtime (and `silmaril/store` if its entry changes), and drop the `--strict`-guard text if codegen is complete. The Babel pipeline was not used in the browser. The sample code paths were checked in Node.js; the browser check was manual (see Stubs left).

## Deviations

- Samples already run on the 0.5 pipeline (compiler and v2 runtime); `switch-to-v2` only changes where the runtime is imported from.
- No `features: 'all'` or COOP/COEP headers: the silmaril runner does not compile brumate components or use threads (the wasip1 binding is not threaded).
- The editor is a plain textarea, with no highlighting while editing.
- Edited `website/src/routes/index.brm` (outside the listed paths) to put the demo on the home page, so `docs-content` prose is untouched. Orchestrator: move it if the home page belongs to another node.
- `--strict` on `check:samples` fails on samples that were compiled and not run. CI uses it now.
- Runs are isolated: a new run of a sample, or the component going away, disposes the last one. It calls the disposers that `$$` and `$$root` return (the runner wraps them), stops the timers and intervals the sample started (`setTimeout`/`setInterval` are bindings of the run), frees the run table entry and revokes the blob URLs. `check:samples` runs a self-check of this with a `setInterval` sample.
- Only `js` fences can be live; the Markdown plugin throws for other languages.
- Import rewriting reads statements that start a line (`import`/`export ... from`, `import 'x'`), so strings are left alone. A dynamic `import()` in a sample is not rewritten.
- Added `@oxc-parser/binding-wasm32-wasip1: 0.155.0` as a website dependency (the brief names it).

## Stubs left

- Expected logs exist only for the two files of `src/samples`; docs fences are checked to run, not for their logs.
- The check of the sample page in a browser was manual (Chrome against `preview`), not automated. After the review fixes the browser extension was not reachable, so the unmount and typing-timer changes in `LiveSample.brm` were built but not seen in a browser.

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
- `pnpm --filter website check:samples`: 2 samples, 0 problems, 0 compiled only, logs asserted (also with `--strict`).
- Chrome on `website preview` (before the move to the v2 runtime): wasm compile loads. The run in the browser with the v2 runtime was not seen.

## Size

- Estimated M, actual M.
