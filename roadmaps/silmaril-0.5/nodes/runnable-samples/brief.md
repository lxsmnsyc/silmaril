---
id: runnable-samples
title: Samples that compile and run in the page
status: todo
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
