# Log: switch-to-v2

- Start at 26ab961. Verify did not hold: `./babel` export, `@babel/*` dependencies and the babel pipeline still present.
- Moved `src/v2/index.ts` to `src/index.ts` (the 0.4 runtime deleted). Deleted `babel/`, `test/compiler.test.ts`, its snapshot and `pipelines/babel.ts`. Removed the `xfail: ['babel']` markers in `let`, `nested` and `limits`.
- `test/behavior/harness.ts` parsed with `@babel/core` to link imports. Switched it to `oxc-parser` (`Literal` for string import names, `ImportExpression` only).
- `silmaril/unplugin` calls `compile`. It drops a `?query` from the id before the compiler picks the language, and returns `undefined` for a module with no compile-time import. Two tests added.
- Runtime size: 2985 B minified, 1412 B gzip -9 (tsdown CLI, neutral platform, es2022, `--minify`). `dist/index.mjs` and `dist/store.mjs` import nothing.
- Dropping `tsx` from `benchmarks` failed: `packages/silmaril/compiler/*.ts` imports without extensions (`./analysis/index`), so plain Node throws ERR_MODULE_NOT_FOUND when the pipeline loads `compiler/index.ts`. Kept `tsx` and `allowBuilds`.
- README samples compiled and run on 0.5 with a scratch script. Fixed: counter started at 0 (`0 * 100` logs 0), composable log comment, nested `$` example (the outer body did not read `y`, so its `onDestroy` never ran on 0.5), `prefix` now tracked, `/*$skip*/` comment removed, scheduling text.
- Examples: both build and run in Chrome under `vite preview` and `vite` dev, no console errors.
