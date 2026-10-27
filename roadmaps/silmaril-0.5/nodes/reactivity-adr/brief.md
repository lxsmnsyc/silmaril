---
id: reactivity-adr
title: Decide and freeze the static-graph runtime
status: active
priority: must
type: contract
milestone: 0.5.0
size: L
spike: true
gate: true
owns:
  - roadmaps/silmaril-0.5/decisions/0001-static-graph-runtime.md
  - packages/silmaril/test/runtime/fixtures/**
provides: [reactivity-runtime]
depends_on: []
---

# Decide and freeze the static-graph runtime

## Goal

Write the decision record for the 0.5 runtime and freeze the `reactivity-runtime` contract: the runtime helpers, the graph table the compiler emits, the order a write runs entries in, and the compiled form of every construct. Add hand-written compiled output per construct as fixtures, so the runtime and the codegen can be built in parallel against them.

## Context

- Direction agreed with the user: a static graph emitted by the compiler, as in brumate. Zero runtime dependencies. Svelte-like. Not runtime signals.
- Model: https://github.com/lxsmnsyc/brumate/blob/main/website/docs/reactive-graph.md (slots, per-slot entry lists, memos before bindings before effects, `Object.is` skip). Leave out resumability and serialization.
- Limits of the 0.4 runtime to fix: every write re-checks every `$sync` in the instance; computeds run in declaration order and can read stale values; a changed `$` rebuilds its whole child instance; effects are scheduled with `setTimeout`; reads inside local helper functions are invisible.
- Current runtime: `packages/silmaril/src/index.ts`. Current output shape: `packages/silmaril/test/__snapshots__/compiler.test.ts.snap`.

## Acceptance

- [ ] `decisions/0001-static-graph-runtime.md` records each choice in the contract's Behavior list, with the alternatives rejected.
- [ ] `contracts/reactivity-runtime.md` lists exact signatures and the graph format, and is ready to set to `frozen`.
- [ ] One fixture per construct (source, hand-written compiled output, expected logs) under `packages/silmaril/test/runtime/fixtures/`.
- [ ] A size estimate for the runtime after minification and gzip, with a target.

## Sizing

Uncertainty high (new design); the code is small. Gate: the user reviews before `runtime-v2` and codegen start.

## Notes for the worker

- Write the contract changes in your outcome and as a proposed replacement file; the orchestrator updates the contract and freezes it after the user approves.
- Decide `$sync` explicitly: keep it as a synchronous effect, or fold it into memos.
