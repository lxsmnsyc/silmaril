---
id: docs-migration
title: Migration, internals and limits pages for 0.5
status: active
priority: should
type: docs
milestone: docs
size: M
added: 2026-10-30
verify: pnpm --filter website build && pnpm --filter website check:samples --strict
owns:
  - website/docs/migration.md
  - website/docs/internals.md
  - website/docs/limits.md
shared:
  - website/src/docs.ts
  - website/src/samples/**
depends_on:
  - on: switch-to-v2
    kind: hard
    why: the migration page follows the 0.5 changeset that switch-to-v2 writes.
  - on: reactivity-adr
    kind: contract
    via: reactivity-runtime
---

# Migration, internals and limits pages for 0.5

## Goal

Add three pages. Migration from 0.4: every breaking change in the 0.5 changeset with a before and after, `silmaril/babel` removed, the deprecated `rollup-plugin-silmaril`, `vite-plugin-silmaril` and `solid-silmaril` packages. Internals: the static reactive graph, slots, entries, the order of runs and the loop guard, in the style of brumate's reactive graph page. Limits: what the compiler does not track (imported functions, opaque helpers, pattern defaults, `typeof` queries) and the 10,000-entry loop guard.

## Context

- The 0.5 changeset in `.changeset/`, `decisions/0001-static-graph-runtime.md` ("Changes from 0.4"), and `contracts/reactivity-runtime.md`.
- brumate's page: https://github.com/lxsmnsyc/brumate/blob/main/website/docs/reactive-graph.md
- The notes for limits are listed in `docs-guide`'s brief (Context).

## Acceptance

- [ ] Every item of the 0.5 changeset appears on the migration page.
- [ ] Each behavior change has a live sample showing the 0.5 result.
- [ ] The three pages are in the sidebar after the guide pages.
- [ ] The prose follows the plain-writing skill. Verify command passes.

## Notes for the worker

- Merge after `docs-reference` (both edit `website/src/docs.ts`).
