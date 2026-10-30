# Log: runnable-samples

- Nothing existed yet. Added the pnpm override for `@napi-rs/wasm-runtime` 1.2.5 and `@oxc-parser/binding-wasm32-wasip1` 0.155.0 in the website.
- `src/live/run.ts` is shared by the page and `scripts/check-samples.ts`: compile, rewrite imports to shims, load from a blob (data URL in Node.js), `console` is a binding that feeds the log list.
- Run mode before codegen: the compiler returns its input, and `$` throws when not compiled, so the sample is compiled and not run. The Babel pipeline in the browser was not tried (heavy).
- Checked the home page in Chrome against `preview`: the wasm compile loads and the sample shows "Compiled, not run".
- Run path (shims, logs) tested in Node.js with a plain module using `$composable`; the v2 fixtures cannot load until `runtime-v2` merges.
- Review fixes: samples must import `silmaril` (check fails otherwise); `--strict` flag; per-run context with timer bindings, `$$` disposer collection, blob revoke, owner-based replacement and unmount dispose; line-start import rewrite; `default` export fix in the shim; only `js` fences are live; dispose self-check in `check-samples.ts`.
- After codegen-core and the merge: MODULES now uses the v2 runtime source (relative import); counter and computed run with asserted logs; CI uses --strict.
