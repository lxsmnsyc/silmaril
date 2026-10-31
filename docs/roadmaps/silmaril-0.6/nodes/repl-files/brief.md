---
id: repl-files
title: REPL examples and share link
status: todo
priority: must
type: feature
story: repl
size: S
owns:
  - website/src/repl/files.ts
provides: [repl-files]
depends_on: []
---

# REPL examples and share link

## Goal

Write `website/src/repl/files.ts` as `contracts/repl-files.md` says: port `encode`, `decode` and `validName` from brumate's `website/src/repl/files.ts`, and write examples: Counter, Computed, Stores, Composable, and "Across modules" (two files, showing the untracked import).

## Acceptance

- [ ] The functions match the contract; round trip holds for every example.
- [ ] Example sources reuse `website/src/samples/*.js` where one fits.

## Sizing

S: one file, ported code.
