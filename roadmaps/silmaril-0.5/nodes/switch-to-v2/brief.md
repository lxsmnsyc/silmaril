---
id: switch-to-v2
title: Switch silmaril to the new compiler and runtime
status: todo
priority: must
type: feature
milestone: 0.5.0
size: M
gate: true
verify: pnpm build && pnpm test && pnpm type-check && pnpm lint && pnpm format:check && pnpm build:examples
owns:
  - packages/silmaril/src/**
  - packages/silmaril/babel/**
  - packages/silmaril/unplugin/**
  - packages/silmaril/test/compiler.test.ts
  - packages/silmaril/test/__snapshots__/**
  - packages/silmaril/test/unplugin.test.ts
  - packages/silmaril/package.json
  - packages/silmaril/tsdown.config.ts
  - README.md
  - packages/silmaril/README.md
  - examples/**
  - .changeset/silmaril-0-5-compiler-and-runtime.md
shared:
  - pnpm-lock.yaml
  - pnpm-workspace.yaml
  - website/src/live/run.ts
  - benchmarks/**
  - packages/silmaril/tsconfig.json
  - packages/silmaril/test/behavior/**
  - packages/silmaril/test/runtime/**
  - packages/silmaril/test/compiler/**
depends_on:
  - on: codegen-extras
    kind: hard
    why: the switch removes the Babel path, so the new compiler must be complete.
  - on: runtime-v2
    kind: hard
    why: moves src/v2 into the main runtime entry.
  - on: fix-babel-plugin
    kind: hard
    why: deletes and rewrites the files the 0.4.1 fix edits; the fix must merge first so it is not lost.
  - on: fix-nested-setup
    kind: hard
    why: deletes the Babel plugin this fix edits; the fix must merge first so it is not lost.
---

# Switch silmaril to the new compiler and runtime

## Goal

Make 0.5 real: `silmaril` exports runtime v2, `silmaril/unplugin` calls `silmaril/compiler`, and `silmaril/babel`, the 0.4 runtime, `@babel/*` dependencies and the Babel snapshot tests are removed. Update the README and the examples, and write the 0.5 changeset with the breaking changes.

## Acceptance

- [ ] No `@babel/*` in `packages/silmaril/package.json`, no `./babel` export.
- [ ] The behavior suite runs only the compiler pipeline and passes; `test/behavior/pipelines/babel.ts` is deleted.
- [ ] Both examples build and work in the browser (checked by hand, gate).
- [ ] `minor` changeset listing: `/babel` removed, `/compiler` added, the `babel` option of `silmaril/unplugin` removed, new scheduling semantics, and every behavior case whose result differs between the two pipelines.
- [ ] `tsconfig.json` include, `keywords` and exports no longer mention `babel`; `src/v2` imports in tests point at the new location.
- [ ] Verify command passes.

## Sizing

Mostly deletion and wiring, but it touches every entry point.

## Notes for the worker

- `rollup-plugin-silmaril` and `vite-plugin-silmaril` wrap `silmaril/unplugin` and need no change; check they still build.
- `oxc-parser` and `magic-string` are regular dependencies of `silmaril` since `compiler-core`, so runtime-only users install the oxc native binding. Kept for now (maintainer, 2026-10-30); weigh optional peers or a separate package here.
- `website/src/live/run.ts` (`MODULES`) imports the v2 runtime by a relative path to `packages/silmaril/src/v2/index.ts`. Point it back at `silmaril` once the package exports v2. `check:samples --strict` already runs in CI (`runnable-samples`' outcome has the details).
- Deleting `test/behavior/pipelines/babel.ts` removes the 0.4 row from `pnpm bench`; the 0.4 and 0.5 numbers are recorded in `benchmarks/README.md` before this node starts. With only `pipelines/compiler.ts` left (explicit `.ts` imports), try running `benchmarks` with plain `node` and drop `tsx` and `allowBuilds: esbuild: false` from `pnpm-workspace.yaml` if it works (`benchmark-harness`' outcome explains why they were added).
- The 0.5 changeset also lists the two behavior changes already in the decision record (a queued `$` runs when a later write restores the old value; reads in a nested entry no longer rerun the outer body) and the loop guard.
