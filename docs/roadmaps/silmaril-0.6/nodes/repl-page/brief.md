---
id: repl-page
title: The /repl route
status: todo
priority: must
type: feature
story: repl
size: L
owns:
  - website/src/routes/repl.brm
  - website/src/repl/highlight.ts
shared:
  - website/src/components/Header.brm
depends_on:
  - on: repl-runner
    kind: behavior
    via: repl-run
  - on: repl-files
    kind: contract
    via: repl-files
---

# The /repl route

## Goal

Port brumate's `website/src/routes/repl.brm` to silmaril: header with example picker and Share, file tabs with add/remove/rename checks, the editor (gutter plus highlighted backdrop, like `LiveSample.brm`), a draggable splitter, and output tabs Console, Compiled (per file), Graph (per file) and Warnings (all files, with file and line). Add a REPL link to `Header.brm`.

## Context

- Drop brumate's Preview, width and background tools and "What ships": silmaril output is console logs, not a DOM.
- Run on load and 400 ms after typing stops, as `LiveSample.brm` does.

## Acceptance

- [ ] Story acceptance items that concern the page.
- [ ] Keyboard: Tab writes two spaces, Escape leaves the editor (as in `LiveSample.brm`).
- [ ] `pnpm --filter website build` passes. Manual browser check reported in the outcome.

## Sizing

L: size medium (one large route, about 800 lines in brumate) with medium uncertainty (porting across two frameworks' sites). Context: brumate's route plus this site's components.
