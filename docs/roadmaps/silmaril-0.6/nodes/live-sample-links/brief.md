---
id: live-sample-links
title: Warnings and an Open in REPL link on live samples
status: todo
priority: could
type: feature
milestone: website
size: S
owns:
  - website/src/components/LiveSample.brm
depends_on:
  - on: repl
    kind: hard
    why: the link opens /repl, which exists only when the story merges.
---

# Warnings and an Open in REPL link on live samples

## Goal

Show the warnings of a live sample above its tabs, and add an "Open in REPL" link (`/repl#<encode([{ name: 'index.js', source }])>`). The Graph view stays in the REPL; samples keep Logs and Compiled.

## Context

- `runSample` returns warnings after `repl-runner` (see `contracts/repl-run.md`).

## Acceptance

- [ ] `limits-in-place.js` shows its warning; other samples show none.
- [ ] The link opens the sample in the REPL with the edits made in the page.
- [ ] `pnpm --filter website build` passes. Manual browser check reported.

## Sizing

S: one component.
