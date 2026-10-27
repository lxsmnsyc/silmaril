---
id: fix-babel-plugin
title: Fix the $$ argument check and compile $skip calls
status: todo
priority: must
type: fix
milestone: 0.4.1
size: S
verify: pnpm --filter silmaril test
owns:
  - packages/silmaril/babel/index.ts
  - packages/silmaril/test/compiler.test.ts
  - packages/silmaril/test/__snapshots__/compiler.test.ts.snap
  - packages/silmaril/src/index.ts
  - README.md
  - packages/silmaril/README.md
  - .changeset/fix-setup-argument-and-skip.md
depends_on: []
---

# Fix the $$ argument check and compile $skip calls

## Goal

Two bugs in the 0.4 Babel plugin, fixed for 0.4.1:

1. The top-level visitor calls `transformSetup(ctx, path, '$')` for a `$$` call, so `isTopLevel` is false and `$$(notAFunction)` compiles silently instead of throwing. Pass `'$$'`.
2. `silmaril` exports `$skip`, which throws at runtime, and the compiler only understands the `/*$skip*/` comment. Replace `$skip(expr)` with `expr` and leave every identifier inside it out of dependency tracking, the same as the comment. Document `$skip` in the README.

## Context

- Bug 1: the `ctx.identifiers.$$.has(binding)` branch of the `CallExpression` visitor in `silmarilPlugin`.
- Bug 2: runtime stub `$skip` in `packages/silmaril/src/index.ts`; comment handling in `canSkip` and `CAN_SKIP`.

## Steps

- [ ] Commit 1: the `$$` argument check, with tests that `$$(1)` and `$$(someIdentifier)` throw.
- [ ] Commit 2: `$skip` calls, with tests and README section.

## Acceptance

- [ ] `$$(1)` throws the "argument must be ArrowFunctionExpression or FunctionExpression" error.
- [ ] `$(console.log(a, $skip(b)))` tracks `a` only, and the output has no `$skip` call.
- [ ] Existing snapshots are unchanged.
- [ ] `$skip` is documented in both READMEs (they are identical).
- [ ] One patch changeset for `silmaril` with both fixes.
- [ ] Fast check passes.

## Sizing

Two small visitor changes, tests and a README section.

## Notes for the worker

- `codegen-extras` reimplements `$skip` in the new compiler and adds its behavior case. Do not edit `test/behavior/`.
