---
id: codegen-extras
title: Codegen for $store, $composable, lifecycles and $skip
status: done
priority: must
type: feature
milestone: 0.5.0
size: M
verify: pnpm --filter silmaril test
owns:
  - packages/silmaril/compiler/codegen/extras/**
  - packages/silmaril/test/compiler/codegen/extras/**
shared:
  - packages/silmaril/compiler/codegen/index.ts
  - packages/silmaril/compiler/codegen/entries.ts
  - packages/silmaril/compiler/codegen/variables.ts
  - packages/silmaril/test/compiler/codegen/fixtures.test.ts
  - packages/silmaril/test/compiler/codegen/constructs.test.ts
  - packages/silmaril/test/behavior/pipelines/compiler.ts
  - packages/silmaril/test/behavior/cases/**
depends_on:
  - on: codegen-core
    kind: hard
    why: extends the code generator that codegen-core writes.
  - on: reactivity-adr
    kind: contract
    via: reactivity-runtime
---

# Codegen for $store, $composable, lifecycles and $skip

## Goal

Finish the compiler: `$store` (one-way for `const`, two-way for `let`), `$composable`, `onMount`, `onDestroy` and `$skip`, on the new runtime. Every behavior case passes on the compiler pipeline.

## Context

- `codegen-core`'s outcome lists the four `failUnsupported` calls to replace (`rewriteSetup` in `entries.ts`, the store branch in `variables.ts`, `rewriteCall` in `index.ts`) and the waiting lists to empty: `WAITING_FOR_EXTRAS` in `test/compiler/codegen/fixtures.test.ts` (18 fixtures), `WAITS_FOR_EXTRAS` / `xfail: ['compiler']` in five case files (27 cases), the `UNSUPPORTED` catch in `pipelines/compiler.ts`, and the last test in `constructs.test.ts`.
- The analysis already models the extras (slots for `$store`, write-back entries, scope bindings for lifecycles, `$skip` calls and their errors). This node only emits.
- The spike's `proto/codegen.ts` prints every extra and passes their fixtures: port those parts.

## Acceptance

- [ ] All behavior cases pass on the compiler plus runtime v2 pipeline; the waiting lists and the `UNSUPPORTED` catch are gone.
- [ ] Every fixture compiles to the text of its `output.js` (after the test's normalization) and logs `expected.json`.
- [ ] The ADR fixtures for these constructs compile to equivalent output.
- [ ] Fast check passes.

## Sizing

Same pattern as codegen-core, fewer constructs.

## Pull request

- #19, merged into `roadmap`.
