---
id: behavior-tests
title: Behavior test suite for any compiler and runtime
status: active
priority: must
type: chore
milestone: 0.5.0
size: M
verify: pnpm --filter silmaril test
owns:
  - packages/silmaril/test/behavior/harness.ts
  - packages/silmaril/test/behavior/pipelines/babel.ts
  - packages/silmaril/test/behavior/cases/**
provides: [behavior-suite]
depends_on: []
---

# Behavior test suite for any compiler and runtime

## Goal

Write a test suite that compiles silmaril code, runs it and checks what it logs, without asserting on compiled output. It takes a pipeline (compiler plus runtime), so the same cases run against the 0.4 Babel pipeline now and the 0.5 compiler later. Freeze the `behavior-suite` contract.

## Context

- The only tests today are output snapshots (`packages/silmaril/test/compiler.test.ts`), and both the compiler and the runtime are about to be rewritten.
- Every example in the README is a good first case: reactive `let`, computed `const` and `let`, `$`, `$sync`, `onMount`, `onDestroy`, `$store` both ways, `$composable`, nested `$` and `$sync`.

## Acceptance

- [ ] `harness.ts` matches the `behavior-suite` contract, and the contract is updated to the final shape.
- [ ] One case file per construct under `cases/`, at least 25 cases in total, all passing on the Babel pipeline.
- [ ] Cases for known limits of the 0.4 runtime (stale computed declared after its dependency, effects reading reads inside local helpers) exist and are marked as expected to fail on the Babel pipeline.
- [ ] Settle in the contract: how `log` reaches the case (global or import), how `import ... from 'silmaril'` resolves to `Pipeline.runtime`, who owns timers (the harness drives fake timers and microtasks in `flush()`), the expected-failure signature (`CaseOptions { xfail?: string[] }`), and whether `compile` may be async.
- [ ] Fast check passes.

## Sizing

New pattern in this repo (medium uncertainty), about 6 to 10 files, no shared code.

## Notes for the worker

- Evaluate compiled modules with `vm.SourceTextModule` or a data URL import with `silmaril` mapped to the runtime under test. Do not depend on the built `dist`.
- Use fake timers or an explicit `flush()` for `$`, which is scheduled with `setTimeout` in 0.4.
