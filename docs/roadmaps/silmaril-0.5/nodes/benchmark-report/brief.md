---
id: benchmark-report
title: Benchmark 0.5 against the 0.4 baseline
status: todo
priority: should
type: chore
milestone: 0.5.0
size: S
exclusive: [bench]
owns:
  - benchmarks/**
depends_on:
  - on: benchmark-harness
    kind: hard
    why: needs the harness and baseline.
  - on: switch-to-v2
    kind: hard
    why: measures the switched pipeline.
---

# Benchmark 0.5 against the 0.4 baseline

## Goal

Add the 0.5 pipeline to the benchmarks, run them, and write the comparison in `benchmarks/README.md`. File follow-up nodes for any regression.

## Acceptance

- [ ] README table with 0.4 and 0.5 numbers side by side.
- [ ] Any regression has a follow-up note in the outcome.

## Notes from earlier waves

- The 0.4 and 0.5 numbers were taken on a quiet machine at `0f55110`, the last commit with both pipelines, and are in `benchmarks/README.md`. After `switch-to-v2` the `babel` pipeline is gone; compare new 0.5 runs with that table.
