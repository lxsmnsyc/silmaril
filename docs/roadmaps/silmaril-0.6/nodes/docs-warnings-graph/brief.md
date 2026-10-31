---
id: docs-warnings-graph
title: Document warnings and the graph dump
status: todo
priority: should
type: docs
milestone: 0.6.0
size: S
owns:
  - website/docs/limits.md
  - website/docs/api.md
  - website/docs/bundler-setup.md
  - website/docs/internals.md
  - README.md
  - packages/silmaril/README.md
  - website/docs/getting-started.md
depends_on:
  - on: repl
    kind: hard
    why: the docs link to the REPL and its examples.
  - on: warn-in-place-mutation
    kind: hard
    why: the docs describe the real messages and output, which exist only once this node lands.
  - on: warn-untracked-entry
    kind: hard
    why: the docs describe the real messages and output, which exist only once this node lands.
  - on: warn-scope-cases
    kind: hard
    why: the docs describe the real messages and output, which exist only once this node lands.
  - on: unplugin-warnings
    kind: hard
    why: the docs describe the real messages and output, which exist only once this node lands.
  - on: graph-output
    kind: hard
    why: the docs describe the real messages and output, which exist only once this node lands.
---

# Document warnings and the graph dump

## Goal

Document the warning codes (what triggers each, how to fix it) in `limits.md` next to each limit, `warnings`, `graph` and the `graph` option in `api.md` and the READMEs, `ignoreWarnings` and `graph` in `bundler-setup.md`, use a graph dump in `internals.md` where it explains slots and entries, and link the REPL from `getting-started.md`.

## Acceptance

- [ ] Every `WarningCode` is documented with a sample. Text follows the plain-writing skill.
- [ ] `pnpm --filter website build` and `check:samples --strict` pass.
- [ ] Both READMEs stay identical in the changed sections.

## Sizing

S: docs only, content comes from the outcomes.
