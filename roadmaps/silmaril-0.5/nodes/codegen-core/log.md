# Log: codegen-core

- 2026-10-30: Started. No `compiler/codegen/` yet; `compile` returns the input. Plan: port `proto/codegen.ts` into `codegen/` (context, variables, writes, entries, temps, imports/graphs), extras constructs throw a "not supported yet" CompileError at the dispatch points codegen-extras fills in.
- Port done in one pass. All 36 fixtures without extras match `output.js` text and logs at once. The 18 others fail only on the "not supported" error.
- Fixed two proto gaps for the v3 write sites: `var` pattern redeclares lost their `var` (undeclared plain names), and `for (var [a] of e)` temps got both `var` and `let`.
- Behavior pipeline `compiler`: 27 extras cases marked `xfail: ['compiler']` (the pipeline turns the "not supported" error into a log line so xfail sees a mismatch). Two cases stated 0.4 behavior that contract v4 changes (`$` queued then value restored, nested entry reads). They now state 0.5, and `xfail: ['babel']`, flagged in the outcome.
- `.ts` imports in the pipeline need `allowImportingTsExtensions` in `packages/silmaril/tsconfig.json` (deviation). `compile.test.ts` asserted the stub and now asserts the output (deviation).
- Review 5709256062: arrow bodies now get parentheses when their text starts with `{` (`{ n }.n`, `{ n } as const`), typed destructuring declarators lose the annotation, and every codegen test re-parses its output with oxc (`compileChecked`).
