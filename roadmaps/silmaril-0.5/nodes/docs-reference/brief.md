---
id: docs-reference
title: API reference and setup pages for 0.5
status: todo
priority: should
type: docs
milestone: docs
size: M
added: 2026-10-30
verify: pnpm --filter website build && pnpm --filter website check:samples --strict
owns:
  - website/docs/getting-started.md
  - website/docs/bundler-setup.md
  - website/docs/api.md
shared:
  - website/src/docs.ts
  - website/src/samples/**
depends_on:
  - on: switch-to-v2
    kind: hard
    why: documents the final exports, subpaths and unplugin options, which switch-to-v2 sets.
  - on: runnable-samples
    kind: hard
    why: uses the live sample fences.
---

# API reference and setup pages for 0.5

## Goal

Rewrite getting started and bundler setup for 0.5 (`silmaril/unplugin`, the Rollup and Vite plugins, no Babel), and add an API reference page that covers every export of every subpath: `silmaril`, `silmaril/store`, `silmaril/solid`, `silmaril/compiler` (`compile`, `ready`, `CompileError`, `SourceMap`) and `silmaril/unplugin` with its options.

## Context

- The exports are in `packages/silmaril/package.json` and the entry files after `switch-to-v2`; `switch-to-v2`'s outcome lists what changed. The compiler's public API is in `contracts/compiler-api.md`.
- Browser use of the compiler needs the wasm binding and the emnapi override (`compiler-infra-spike`'s outcome, Gotchas; `runnable-samples`' outcome).

## Acceptance

- [ ] Getting started installs and runs a first example on 0.5 with one bundler.
- [ ] Bundler setup covers Vite, Rollup and the unplugin with every option, and the browser compiler setup.
- [ ] `api.md` documents every export and subpath with its signature and a short example; it is in the sidebar.
- [ ] The prose follows the plain-writing skill. Verify command passes.

## Notes for the worker

- Merge order: `docs-reference`, then `docs-migration`, both edit `website/src/docs.ts`.
