---
id: repl-runner
title: Run several files in the page
status: todo
priority: must
type: feature
story: repl
size: M
verify: pnpm --filter website check:samples --strict
owns:
  - website/src/live/run.ts
  - website/scripts/check-samples.ts
provides: [repl-run]
depends_on:
  - on: compile-api
    kind: contract
    via: compile-result
---

# Run several files in the page

## Goal

Implement `runFiles` from `contracts/repl-run.md` in `website/src/live/run.ts`, and make `runSample` call it with one file. Each file compiles with `graph: true`; relative imports between files load from blob URLs like the entry does today.

## Context

- `website/src/live/run.ts` rewrites `silmaril` imports with `IMPORT_PATTERN` and loads blob URLs. Relative imports need the same rewrite to the blob URL of the imported file, so compile and load files in dependency order and reject cycles with a clear error.
- brumate's runner does the same for `.brm` files: `brumate/website/src/live/run.ts`.

## Acceptance

- [ ] Contract tests pass; existing samples still pass `check:samples --strict`.
- [ ] Blob URLs of every file are revoked on dispose.
- [ ] Fast check passes. No changeset (website).

## Sizing

M: one file plus the check, a new pattern (module graph) in a known runner.
