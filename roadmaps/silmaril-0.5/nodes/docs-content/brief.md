---
id: docs-content
title: Full documentation for 0.5
status: todo
priority: should
type: docs
milestone: docs
size: L
outline: true
owns:
  - website/docs/**
depends_on:
  - on: website-skeleton
    kind: hard
    why: writes pages in the website.
  - on: reactivity-adr
    kind: contract
    via: reactivity-runtime
  - on: switch-to-v2
    kind: behavior
    via: reactivity-runtime
---

# Full documentation for 0.5

## Goal

Write the 0.5 documentation: guide, API reference for every export and subpath, bundler setup per bundler, Solid interop, migration from 0.4 (`/babel` removed, new scheduling, the deprecated packages), and an internals page on the reactive graph. Refine into briefs once `switch-to-v2` is close.

## Notes from earlier waves

- Document the loop guard: one write that reaches more than 10,000 entries in one drain throws `Update loop` (accepted by the maintainer, 2026-10-30).
