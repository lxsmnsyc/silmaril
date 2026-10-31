---
id: compile-api
title: compile() returns warnings and graph
status: todo
priority: must
type: contract
milestone: 0.6.0
size: S
gate: true
verify: pnpm --filter silmaril test
owns:
  - packages/silmaril/compiler/index.ts
  - packages/silmaril/compiler/errors.ts
  - packages/silmaril/compiler/analysis/warnings/index.ts
  - packages/silmaril/test/compiler/analysis/compile.test.ts
provides: [compile-result]
depends_on: []
---

# compile() returns warnings and graph

## Goal

Freeze the `compile-result` contract in code: the new types, `warnings` and `graph` on every result, the `graph` option, and an empty warning registry that later nodes append to. No warning fires yet.

## Context

- Contract: `contracts/compile-result.md`.
- `errors.ts` has `locateOffset` and `createCodeFrame`. Export them (or a helper) so a warning gets the same `loc` and `frame` as a `CompileError`.
- `analyzeModule` returns the model or null; `compile()` in `compiler/index.ts` is the place to run the registry.

## Acceptance

- [ ] The types in the contract are exported from `silmaril/compiler`, with doc comments.
- [ ] The contract tests listed in the contract pass.
- [ ] A changeset (`minor`) describes `warnings`, `graph` and the `graph` option.
- [ ] Fast check passes.

## Sizing

S: two source files and one test file, the pattern of `CompileError` already exists.

## Notes for the worker

- Do not add a `warnings` option to turn checks off. The bundler plugin filters.
