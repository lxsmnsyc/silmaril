# Outcome: fix-nested-setup

## Built

- `packages/silmaril/babel/index.ts`: plugin state has a `transformed` WeakSet. `transformSetup` returns early for a call node it already handled, so a nested `$$` is transformed once.
- `packages/silmaril/test/compiler.test.ts`: test "nested $$" checks the reproduction compiles to two context declarations, one per setup body.
- `.changeset/nested-setup-single-context.md`: patch for `silmaril`.

## Deviations

- None. Tracking of outer variables is unchanged.

## Stubs left

- None.

## Gotchas

- The oxc compiler must also transform each setup once. The inner `$(console.log(a))` still does not track the outer `a`; that question stays with the maintainer.

## Proposed learnings

- None.

## Verification

- Before the fix: the new test failed (3 contexts, expected 2).
- After: `pnpm install --frozen-lockfile && pnpm build && pnpm test && pnpm type-check && pnpm lint && pnpm format:check` and `pnpm build:examples`.
- Existing snapshots unchanged; none contained the duplicate.

## Size

- Estimated S, actual S.
