# Outcome: codegen-extras

## Built

- Code generation for `$store`, `$composable`, `onMount`, `onDestroy` and `$skip` in `packages/silmaril/compiler/codegen/`:
  - `entries.ts` `rewriteSetup`: `$composable` prints `$$composable`, same edits as `$$`.
  - `variables.ts` `openDeclarator`: `$store` prints `$$store(sc, k, e)` and adds the write-back entry id for a `let` (`$$store(sc, k, e, n)`). Plain declarators around it keep their keyword.
  - `index.ts` `rewriteCall`: `$skip(e)` prints `(e)` (slot reads inside it still print `$$get`); `onMount`/`onDestroy` print `$$mount`/`$$destroy` with the bound scope parameter first.
  - `context.ts`: `failUnsupported` removed (no caller left).
- Waiting lists removed: `WAITING_FOR_EXTRAS` (fixtures.test.ts), `WAITS_FOR_EXTRAS` in the 5 case files, the `UNSUPPORTED` catch in `pipelines/compiler.ts`, the last test of `constructs.test.ts`.
- `test/compiler/codegen/extras/extras.test.ts`: 6 tests (store between plain declarators, TS wrapper, aliased names, `$skip` with a slot read, `onMount` in an entry scope, composable).
- Changeset `.changeset/silmaril-compiler-codegen-extras.md` (patch).

## Deviations

- Edits to shared paths only, plus the removal of `failUnsupported` from `compiler/codegen/context.ts`, which is a codegen-core file the brief does not list.
- The extras live in the shared `codegen/variables.ts`, `entries.ts` and `index.ts` (about 30 lines) instead of `compiler/codegen/extras/*.ts` as the compiler-api layout table says. It is simpler, and those files are listed as shared.
- No change request.

## Stubs left

- None.

## Gotchas

- None beyond codegen-core's. The `compiler` pipeline now runs all cases; only the `babel` xfails remain.

## Proposed learnings

- None.

## Verification

- `pnpm --filter silmaril test`: 25 files, 577 tests pass. All 54 non-error fixtures match `output.js` (after normalization) and log `expected.json`; the 7 error fixtures throw.
- All behavior cases pass on the compiler pipeline (no `xfail: ['compiler']` left).
- Fast check (install, build, test, type-check, lint) passes. `pnpm format:check` passes.

## Size

- Estimated M, actual S. The prototype ported as written.
