---
id: warn-untracked-entry
title: Warn on an entry that tracks nothing
status: todo
priority: must
type: feature
milestone: 0.6.0
size: M
verify: pnpm --filter silmaril test
owns:
  - packages/silmaril/compiler/analysis/warnings/untracked-entry.ts
  - packages/silmaril/test/compiler/analysis/warnings/untracked-entry.test.ts
shared:
  - packages/silmaril/compiler/analysis/warnings/index.ts
depends_on:
  - on: compile-api
    kind: contract
    via: compile-result
---

# Warn on an entry that tracks nothing

## Goal

Report `untracked-entry` on a `$` or `$sync` that reads no reactive variable and calls at least one function the compiler cannot follow (imported, module-level, a parameter, a member call, a namespace call, a written binding). It runs once and never again, which users read as "my effect is broken" (`website/docs/limits.md`, "Functions the compiler cannot follow").

## Context

- Entry reads come from `computeEntryReads` in `analysis/reads.ts`; local function calls are resolved by `findLocalFunction`.
- Message example: "This `$` reads no reactive variable, so it runs once. `read()` is not followed: pass the values it needs as arguments."

## Acceptance

- [ ] Warns for each opaque call kind listed in the goal, when the entry has no reads.
- [ ] No warning when the entry reads any variable, when it calls only local functions, when the opaque call is inside `$skip(...)` and the entry reads something, or when the entry calls nothing (such as `$(console.log('ready'))`: `console.log` is a member call, so decide and test it; the default is no warning when every opaque call is a member of a global).
- [ ] Fast check passes. Changeset.

## Sizing

M: reads the model plus the call resolution in `reads.ts`; the false-positive line needs care.

## Notes for the worker

- False positives cost more than misses here. When unsure, do not warn, and list the case in the outcome.
