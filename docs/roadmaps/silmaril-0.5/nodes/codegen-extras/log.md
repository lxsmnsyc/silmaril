# Log: codegen-extras

- Ported the extras from `proto/codegen.ts` into the four `failUnsupported` sites. All 54 fixtures matched on the first run.
- Emptied the waiting lists and the `UNSUPPORTED` catch, dropped the last `constructs.test.ts` test, removed `failUnsupported` from `context.ts` (unused).
- Added `test/compiler/codegen/extras/extras.test.ts` (6 tests, all through `compileChecked`).
- Fast check passes.
