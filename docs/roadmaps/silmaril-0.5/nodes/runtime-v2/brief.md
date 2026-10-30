---
id: runtime-v2
title: Static-graph runtime
status: done
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
- [ ] Size pass (maintainer decision, 2026-10-27): the reference sketch (`nodes/reactivity-adr/sketch/runtime.js`, contract v4) measures 1481 B gzip against the 1.5 kB cap. Work toward the 1.2 kB aim without changing behavior: lazy allocation of scope arrays, a cheaper queue than the O(n^2) scan, shared code paths. Report the size after each change in the outcome. The 1.5 kB cap is hard; if 1.2 kB is not reachable, say what each remaining part costs.
- [ ] No dependencies added.
- [ ] Fast check passes.

## Sizing

Known pattern once the contract is frozen; small code, many tests.

## Notes for the worker

- Do not touch `src/index.ts`; the 0.4 runtime must keep working until the switch.

## Pull request

- #13, merged into `roadmap`. 1417 B gzip, accepted by the maintainer on 2026-10-30 (under the 1.5 kB cap, over the 1.2 kB aim). Allocation follow-ups are in the outcome.
