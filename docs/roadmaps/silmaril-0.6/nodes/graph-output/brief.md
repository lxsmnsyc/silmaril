---
id: graph-output
title: Text dump of the reactive graph
status: todo
priority: should
type: feature
milestone: 0.6.0
size: M
verify: pnpm --filter silmaril test
owns:
  - packages/silmaril/compiler/graph.ts
  - packages/silmaril/test/compiler/graph.test.ts
shared:
  - packages/silmaril/compiler/index.ts
  - packages/silmaril/unplugin/index.ts
depends_on:
  - on: compile-api
    kind: contract
    via: compile-result
  - on: unplugin-warnings
    kind: hard
    why: both edit the plugin options and handler in unplugin/index.ts; land after it to avoid a conflict.
---

# Text dump of the reactive graph

## Goal

Fill `result.graph` when `compile(code, { graph: true })`: one block per setup, in source order, listing each slot (name and line) and what a write to it runs (computed variables, `$sync`, `$`, store write-backs, by name or line), with nested scopes indented. Add `graph?: boolean` to the plugin options; when true the plugin prints each module's dump with `this.warn` or the bundler's info log (pick the one that prints by default in Vite and say which in the outcome).

## Context

- The model is `ModuleModel` in `analysis/model.ts`: `ReactiveScope.slots`, `entries` and `graph` (refs per slot, the same shape the runtime reads).
- Proposed form, to refine with real output:

```
$$ at counter.js:3
  count (line 4) -> message (line 5), $sync (line 6)
  message (line 5) -> $ (line 7)
```

## Acceptance

- [ ] Snapshot tests for: one setup, nested setup, `$composable`, `$store` binding, nested `$`.
- [ ] Compiled `code` is byte-identical with and without `graph: true` (test).
- [ ] `graph` is null for an unchanged module and when the option is off.
- [ ] Fast check passes. Changeset.

## Sizing

M: one new file reading the model, plus a small hook in `compile()` and the plugin.

## Notes for the worker

- The text format is not an API. Say so in the doc comment, so it can change in a patch.
