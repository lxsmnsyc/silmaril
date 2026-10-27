# Outcome: fix-babel-plugin

## Built

- `packages/silmaril/babel/index.ts`: the top-level visitor passes `'$$'` to `transformSetup`, so `$$(1)` and `$$(someIdentifier)` throw "$$ argument must be ArrowFunctionExpression or FunctionExpression".
- `packages/silmaril/babel/index.ts`: `$skip` is a tracked import. `getDependencies` ignores everything inside a `$skip(...)` call. A `Program` exit visitor replaces `$skip(expr)` with `expr`. `$skip` with a number of arguments other than one throws.
- `packages/silmaril/test/compiler.test.ts`: tests for both `$$` throws and two `$skip` cases (an effect and a computed value), as inline snapshots. The existing snapshot file is unchanged.
- `README.md` and `packages/silmaril/README.md` (byte-identical): new "Skipping tracking" section.
- `.changeset/fix-setup-argument-and-skip.md`: patch for `silmaril`.

## Deviations

- None. The `$skip` runtime stub in `src/index.ts` is left as is.

## Stubs left

- None.

## Gotchas

- `$skip` removal runs at `Program` exit, after tracking is computed. A later node that reimplements this in the oxc compiler must also collect dependencies before it strips the call.
- The `/*$skip*/` comment still works and is used by the compiler for its own generated declarators.

## Proposed learnings

- None.

## Verification

- Before the fix: `pnpm --filter silmaril test` gave 2 failed, 20 passed (the two new `$$` tests).
- After the fix: 24 passed, existing snapshots unchanged.
- `pnpm install --frozen-lockfile && pnpm build && pnpm test && pnpm type-check && pnpm lint` and `pnpm format:check` pass.
- Acceptance: `$$(1)` throws (pass), `$(console.log(a, $skip(b)))` tracks `a` only with no `$skip` in output (pass), snapshots unchanged (pass), READMEs identical and document `$skip` (pass), one patch changeset (pass).

## Size

- Estimated S, actual S.
