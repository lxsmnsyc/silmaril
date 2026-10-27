---
id: runtime-v2
title: Static-graph runtime
status: todo
priority: must
type: feature
milestone: 0.5.0
size: M
verify: pnpm --filter silmaril test
owns:
  - packages/silmaril/src/v2/**
  - packages/silmaril/test/runtime/*.test.ts
shared:
  - packages/silmaril/test/behavior/cases/**
depends_on:
  - on: reactivity-adr
    kind: contract
    via: reactivity-runtime
---

# Static-graph runtime

## Goal

Implement the `reactivity-runtime` contract in `packages/silmaril/src/v2/`, next to the 0.4 runtime, and run the ADR's hand-written fixtures against it. It is not exported yet; `switch-to-v2` swaps it in.

## Context

- The contract and `decisions/0001-static-graph-runtime.md` define everything.
- `silmaril/store` and `silmaril/solid` use the `Store` interface from `src/index.ts`; keep it compatible.

## Acceptance

- [ ] Every fixture under `test/runtime/fixtures/` passes.
- [ ] Unit tests for: write ordering, batching, `Object.is` skip, disposal of child scopes, `onMount`, `onDestroy`, store subscription cleanup.
- [ ] Size after minify and gzip is within the ADR's target, measured in the outcome.
- [ ] No dependencies added.
- [ ] Fast check passes.

## Sizing

Known pattern once the contract is frozen; small code, many tests.

## Notes for the worker

- Do not touch `src/index.ts`; the 0.4 runtime must keep working until the switch.
