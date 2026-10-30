# Log: compiler-core

- 2026-10-30: `packages/silmaril/compiler/` did not exist. Started from f715114.
- Added `oxc-parser` 0.155.0 (exact) and `magic-string` ^1.4.4 (1.4.4 installed) to `dependencies`, and `@oxc-parser/binding-wasm32-wasip1` 0.155.0 as an optional peer. `@oxc-project/types` is not needed: `oxc-parser` re-exports the AST types.
- Ported `proto/source.ts`, `scope.ts` and `model.ts` into the contract's file layout, typed with the oxc AST types. `model.ts` split into `model.ts` (types, steps 2, 3, 5 to 7, 9, 12, 13), `reads.ts`, `writes.ts` and `checks.ts`. `fail` lives in `checks.ts` so that `checks.ts` and `writes.ts` import no value from `model.ts` (oxlint `import/no-cycle`; type-only cycles are allowed).
- Imports use no extension, as the rest of the package does.
- Fixture model test: 55 fixtures with an `output.js` match, 7 compile errors match. `namespace-root` has no named import, so the model is null and nothing is registered.
- Wrote outcome, the changeset (minor, new entry) and a change request for the type of `WriteSite.fn`. Fast check and `pnpm format:check` pass.
