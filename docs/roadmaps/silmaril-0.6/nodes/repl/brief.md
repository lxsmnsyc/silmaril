---
id: repl
title: REPL page
status: todo
priority: must
type: story
milestone: website
size: L
outline: false
depends_on:
  - on: compile-api
    kind: contract
    via: compile-result
---

# REPL page

## Goal

A `/repl` page like brumate's (`brumate/website/src/routes/repl.brm`): several files, an editor with highlighting, examples, a share link, and output tabs Console, Compiled, Graph and Warnings. It replaces the parked 0.5 `playground` node. Ships as one pull request from `feat/repl`.

## Acceptance

- [ ] Every example runs and logs what it says, checked by `check-samples.ts`.
- [ ] A share link opens the same files in a new tab.
- [ ] A two-file example shows the cross-module limit: a helper module that reads a value is not tracked, and the Warnings tab says so.
- [ ] Manual check in a browser on `pnpm --filter website preview`.
