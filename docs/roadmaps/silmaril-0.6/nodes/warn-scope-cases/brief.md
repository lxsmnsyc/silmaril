---
id: warn-scope-cases
title: Warn on pattern defaults and loop-local reads
status: todo
priority: should
type: feature
milestone: 0.6.0
size: M
verify: pnpm --filter silmaril test
owns:
  - packages/silmaril/compiler/analysis/warnings/pattern-default.ts
  - packages/silmaril/compiler/analysis/warnings/loop-local-read.ts
  - packages/silmaril/test/compiler/analysis/warnings/pattern-default.test.ts
  - packages/silmaril/test/compiler/analysis/warnings/loop-local-read.test.ts
shared:
  - packages/silmaril/compiler/analysis/warnings/index.ts
depends_on:
  - on: compile-api
    kind: contract
    via: compile-result
---

# Warn on pattern defaults and loop-local reads

## Goal

Two checks from `website/docs/limits.md`:

- `pattern-default`: a reactive read in a default of a declaration pattern, as in `const { b = a } = props`. It reads `a` once and does not follow it.
- `loop-local-read`: an entry or computed variable reads a variable declared in a loop or a nested function that is written after the read site. The write runs nothing.

## Acceptance

- [ ] Each check warns on the samples in `limits.md` ("Defaults in declaration patterns" and the first item of "Other limits").
- [ ] No warning for a default with no reactive read, or for a loop-local variable that is never written.
- [ ] Fast check passes. Changeset.

## Sizing

M: two small checks with the same shape; scope data is in `analysis/scope.ts`.

## Notes for the worker

- If `loop-local-read` turns out noisy on the behavior suite (`packages/silmaril/test/behavior/cases`), ship `pattern-default` alone and say so in the outcome.
