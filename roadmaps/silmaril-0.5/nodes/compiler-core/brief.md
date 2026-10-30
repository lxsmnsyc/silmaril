---
id: compiler-core
title: silmaril/compiler parsing and analysis
status: active
priority: must
type: feature
milestone: 0.5.0
size: L
verify: pnpm --filter silmaril test
owns:
  - packages/silmaril/compiler/index.ts
  - packages/silmaril/compiler/analysis/**
  - packages/silmaril/compiler/errors.ts
  - packages/silmaril/compiler/source.ts
  - packages/silmaril/test/compiler/analysis/**
shared:
  - packages/silmaril/package.json
  - packages/silmaril/tsdown.config.ts
  - packages/silmaril/tsconfig.json
  - pnpm-lock.yaml
depends_on:
  - on: compiler-infra-spike
    kind: contract
    via: compiler-api
---

# silmaril/compiler parsing and analysis

## Goal

Build the front half of `silmaril/compiler`: parse with oxc-parser, find the `silmaril` imports, resolve bindings, find the reactive variables of each setup body, follow calls to functions declared in the same setup, and set up magic-string with source maps and `CompileError` with code frames. Expose `compile()` from a new `./compiler` entry; until codegen lands it returns the input unchanged.

## Context

- The spike's outcome (`nodes/compiler-infra-spike/outcome.md`) and the `compiler-api` contract define the design. The prototype in `nodes/compiler-infra-spike/proto/` (`source.ts`, `scope.ts`, `model.ts`, `test.ts`, `fixtures.test.ts`) passes every fixture of `reactivity-runtime` v4: port it rather than start over.
- What to detect is in `packages/silmaril/babel/index.ts` (`TRACKED_IMPORTS`, `extractImportIdentifiers`, `traverseIdentifiers`, `unwrapLVal`, `getDependencies`) and `babel/unwrap-node.ts`.

## Acceptance

- [ ] `silmaril/compiler` is built and exported, with types.
- [ ] The model half of the spike's fixture test is ported: for every fixture under `test/runtime/fixtures/` with an `output.js`, the slots, entries and graphs of the model equal the ones `output.js` encodes, and every compile-error fixture throws its message.
- [ ] Analysis tests cover: aliased imports, shadowed names, destructuring patterns, TS wrappers, nested setups, local helper calls (direct, transitive, recursive, and a reassigned helper), and errors with locations.
- [ ] Helpers that the contract does not treat as local functions are opaque, and that limit is in the outcome for the docs.
- [ ] No `@babel/*` import under `compiler/`.
- [ ] Fast check passes.

## Sizing

Uncertainty medium after the spike, size medium-high, adds dependencies (lockfile).

## Notes for the worker

- Add `oxc-parser` and `magic-string` to `dependencies`. Add the `compiler` entry to `tsdown.config.ts` (with the platform the spike chose) and `compiler` to the `tsconfig.json` include.
- Leave `compiler/codegen/` to the codegen nodes; `index.ts` calls `codegen/index.ts` once it exists.
- Keep analysis and code generation in separate modules, so the codegen nodes own their own files.
- Run the whole analysis on the original AST before any magic-string edit. Codegen reads analysis results only (see reviews/premortem.md, item 1).
