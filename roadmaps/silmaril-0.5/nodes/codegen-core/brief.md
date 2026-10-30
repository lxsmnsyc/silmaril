---
id: codegen-core
title: Codegen for variables, computeds, $ and $sync
status: active
priority: must
type: feature
milestone: 0.5.0
size: L
verify: pnpm --filter silmaril test
owns:
  - packages/silmaril/compiler/codegen/**
  - packages/silmaril/test/compiler/codegen/**
  - packages/silmaril/test/behavior/pipelines/compiler.ts
shared:
  - packages/silmaril/test/behavior/cases/**
depends_on:
  - on: compiler-core
    kind: hard
    why: generation walks the analysis results and edits through the magic-string instance that compiler-core builds; a stub of the analysis would be as large as the analysis itself.
  - on: reactivity-adr
    kind: contract
    via: reactivity-runtime
  - on: runtime-v2
    kind: behavior
    via: reactivity-runtime
  - on: behavior-tests
    kind: behavior
    via: behavior-suite
---

# Codegen for variables, computeds, $ and $sync

## Goal

Make `silmaril/compiler` emit code for the new runtime for `$$`, reactive `let`, computed `const` and `let`, `$`, `$sync`, nested setups and local helper calls. Add a behavior-suite pipeline for compiler plus runtime v2 and make every case for these constructs pass on it.

## Context

- The ADR fixtures show the expected output shape for each construct.
- `compiler-api` v3 has the edit rules and the write sites, `TempOwner` included. `compiler-core`'s outcome lists the analysis API as built and the new write sites (loop `var` redeclares, `for (var x of e)` heads).
- The spike's `nodes/compiler-infra-spike/proto/codegen.ts` passes every fixture's text and logs against the v4 sketch: port it rather than start over.
- `runtime-v2` has merged: the runtime is `packages/silmaril/src/v2/`. Run compiled fixtures and behavior cases against it.

## Acceptance

- [ ] Fixtures for these constructs compile to output equivalent to the hand-written ones.
- [ ] Behavior cases for these constructs pass on the new pipeline, including the 0.4 known-limit cases.
- [ ] Source maps point back to the original positions (one test per construct).
- [ ] Fast check passes.

## Sizing

New code generation on a new runtime: uncertainty medium, size high.

## Notes for the worker

- `compiler/index.ts` belongs to `compiler-core`. Calling `generate(s, model)` there is the one edit you make to it (the spot is in `compiler-core`'s outcome); record it under Deviations.
- In the new pipeline file, import with explicit `.ts` paths (no directory or extensionless imports), so the pipeline loads under plain Node. `benchmarks/` discovers pipelines from that folder.
