---
id: runnable-samples
title: Samples that compile and run in the page
status: done
priority: should
type: feature
milestone: docs
size: M
owns:
  - website/src/samples/**
  - website/scripts/check-samples.ts
shared:
  - website/package.json
  - .github/workflows/ci.yml
depends_on:
  - on: website-skeleton
    kind: hard
    why: builds inside the website package.
  - on: compiler-core
    kind: contract
    via: compiler-api
  - on: switch-to-v2
    kind: behavior
    via: compiler-api
---

# Samples that compile and run in the page

## Goal

Let code samples on the website compile with `silmaril/compiler` in the browser (oxc wasm binding) and run against the runtime, showing their logs, like brumate's samples. Add a `check:samples` script that compiles and runs every sample in CI.

## Acceptance

- [ ] A sample shows its source, a run button and its logs; editing the source recompiles.
- [ ] `pnpm --filter website check:samples` compiles and runs every sample.
- [ ] After `switch-to-v2`, every sample runs on the 0.5 pipeline.

## Notes from earlier waves

- Browser pages that load oxc need the override `@napi-rs/wasm-runtime: 1.2.5` (pnpm `overrides` in `pnpm-workspace.yaml`) and `@oxc-parser/binding-wasm32-wasip1` at the same version as `oxc-parser` (0.155.0). In Vite, exclude `oxc-parser` and the binding from `optimizeDeps` and use a target that allows top-level await. Details in `nodes/compiler-infra-spike/outcome.md`, Gotchas.
- `silmaril/compiler` returns its input unchanged until `codegen-core` merges. Build the sample runner against the `compile()` interface and the behavior-suite's runner idea; until codegen lands, samples can be checked for compile and load only, or run on the 0.4 Babel pipeline if that is cheap in the browser. Say which in the outcome.

## Pull request

- #16, merged into `roadmap`.
