---
name: reactivity-runtime
version: 1
status: draft
defined_by: reactivity-adr
---

# Contract: reactivity-runtime

## Purpose

The interface between the code `silmaril/compiler` emits and the runtime in `silmaril` (`src/`). `runtime-v2` implements it, `codegen-core` and `codegen-extras` emit code against it, and `docs-content` explains it. `reactivity-adr` fills in this draft and freezes it.

## Interface

To be frozen by `reactivity-adr`. The draft direction, taken from brumate's reactive graph:

```ts
// One scope per `$$`, `$`, `$sync` and `$composable` body.
interface Scope {
  /* slots, parent, children, disposers; shape decided by the ADR */
}

// Emitted helpers (names and arities decided by the ADR).
function $$scope(parent: Scope | undefined, graph: Graph, size: number): Scope;
function $$get(scope: Scope, slot: number): unknown;
function $$set<T>(scope: Scope, slot: number, value: T): T;
function $$memo(scope: Scope, slot: number, compute: () => unknown): void;
function $$dispose(scope: Scope): void;

// Per-component table emitted by the compiler: slot -> entries to run on write.
type Graph = {/* decided by the ADR */};
```

## Behavior

The ADR decides each of these and writes the answer here:

- The import specifier the compiled code imports helpers from (today: `'silmaril'`). Fixtures and the behavior-suite `Pipeline.runtime` must both resolve it, including while `runtime-v2` lives in the unexported `src/v2/`.
- The helpers for `$`, `$sync`, `$store`, `onMount`, `onDestroy` and `$composable`, alongside the ones listed above.

- The order in which a write runs entries: memos in topological order, then `$sync` bodies, then `$` bodies.
- Whether `$` runs in a microtask, and how several writes in one task batch.
- A write of the same value (`Object.is`) runs nothing.
- When a `$` or `$sync` body is disposed and run again, and how its child scope is disposed.
- How `onMount` and `onDestroy` attach to a scope.
- How `$store` subscribes, writes back for `let`, and unsubscribes on dispose.
- What `$composable` returns and how its scope attaches to the caller's.
- How the compiler follows calls to functions declared in the same `$$` to add what they read.
- What stays out of tracking: reads inside imported functions, and `$skip`.

## Stub

`reactivity-adr` adds hand-written compiled output for each construct under `packages/silmaril/test/runtime/fixtures/`, so `runtime-v2` can test without the compiler and the codegen nodes have a target.

## Contract tests

`packages/silmaril/test/runtime/` runs the hand-written fixtures against the runtime. The behavior suite (`behavior-suite` contract) runs compiled code end to end.

## Changes

- v1: draft.
