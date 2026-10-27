---
name: behavior-suite
version: 1
status: draft
defined_by: behavior-tests
---

# Contract: behavior-suite

## Purpose

A test suite that compiles silmaril code, runs it, and checks what it does, without looking at the compiled output. It runs against any pair of compiler and runtime, so the same cases check the 0.4 Babel pipeline and the 0.5 compiler. `behavior-tests` writes it; `runtime-v2`, `codegen-core`, `codegen-extras` and `switch-to-v2` add cases and run it.

## Interface

Frozen by `behavior-tests`. Draft:

```ts
// packages/silmaril/test/behavior/harness.ts
export interface Pipeline {
  name: string;
  compile(code: string, filename: string): string; // compiled module source
  runtime: Record<string, unknown>; // what `import ... from 'silmaril'` resolves to
}

export interface RunResult {
  logs: unknown[][]; // every call to the injected `log`
  flush(): Promise<void>; // waits for scheduled effects
}

export function run(pipeline: Pipeline, code: string): Promise<RunResult>;
```

- Cases live in `packages/silmaril/test/behavior/cases/*.test.ts`, one file per construct.
- A case can mark itself as expected to fail on a named pipeline (for semantics that 0.5 changes).

## Behavior

- Cases call `log(...)` instead of `console.log`.
- A case never asserts on compiled code.

## Stub

None.

## Contract tests

The suite itself.

## Changes

- v1: draft.
