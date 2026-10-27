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
