---
id: benchmark-harness
title: Compile and update benchmarks with a 0.4 baseline
status: done
priority: should
type: chore
milestone: 0.5.0
size: M
exclusive: [bench]
owns:
  - benchmarks/**
shared:
  - pnpm-workspace.yaml
  - pnpm-lock.yaml
  - package.json
depends_on:
  - on: behavior-tests
    kind: contract
    via: behavior-suite
---

# Compile and update benchmarks with a 0.4 baseline

## Goal

Add a `benchmarks` workspace package that measures compile time and memory (per file size) and runtime update cost (one write with N computeds and effects, many writes in a batch), parameterized by the `Pipeline` type of the behavior suite. Record the 0.4 Babel baseline in `benchmarks/README.md`.

## Acceptance

- [ ] `pnpm bench` runs both benchmarks and prints a table.
- [ ] Baseline numbers for 0.4 are in `benchmarks/README.md`, with the machine and Node.js version.
- [ ] Fast check passes.

## Sizing

Known pattern (brumate has a `benchmarks` folder); new to this repo.

## Notes for the worker

- Keep benchmark dependencies out of `packages/silmaril`.

## Pull request

- #14, merged into `roadmap`. The 0.4 baseline was taken under load (load average about 10); re-run `pnpm bench` on a quiet machine before `benchmark-report`. `tsx` and `allowBuilds: esbuild: false` can go once every behavior-suite pipeline imports with explicit `.ts` paths.
