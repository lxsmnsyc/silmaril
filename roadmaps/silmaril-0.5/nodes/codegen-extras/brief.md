---
id: codegen-extras
title: Codegen for $store, $composable, lifecycles and $skip
status: todo
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

## Acceptance

- [ ] All behavior cases pass on the compiler plus runtime v2 pipeline.
- [ ] The ADR fixtures for these constructs compile to equivalent output.
- [ ] Fast check passes.

## Sizing

Same pattern as codegen-core, fewer constructs.
