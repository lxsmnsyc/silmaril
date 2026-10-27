---
name: behavior-suite
version: 2
status: frozen-proposal
defined_by: behavior-tests
---

# Contract: behavior-suite

## Purpose

A test suite that compiles silmaril code, runs it, and checks what it logs, without looking at the compiled output. It runs against any pair of compiler and runtime, so the same cases check the 0.4 Babel pipeline and the 0.5 compiler. `behavior-tests` wrote it; `runtime-v2`, `codegen-core`, `codegen-extras` and `switch-to-v2` add pipelines and cases and run it.

## Interface

```ts
// packages/silmaril/test/behavior/harness.ts
export interface Pipeline {
  name: string; // unique; the key used by CaseOptions.xfail
  compile(code: string, filename: string): string | Promise<string>; // compiled module source
  runtime: Record<string, unknown>; // what `import ... from 'silmaril'` resolves to
  modules?: Record<string, unknown>; // extra specifiers, merged over the defaults
}

export interface RunResult {
  logs: unknown[][]; // every call to the injected `log`, in order
  flush(): Promise<void>; // runs fake timers and microtasks until nothing is scheduled
  dispose(): void; // restores real timers
}

export interface CaseOptions {
  xfail?: string[]; // pipeline names on which the case is expected to fail
}

export interface BehaviorCase {
  name: string;
  code: string; // module source; uses `log(...)` and optionally `await flush()`
  logs: unknown[][]; // expected arguments of every `log` call
  options?: CaseOptions;
}

export function checkCase(pipeline: Pipeline, item: BehaviorCase): Promise<void>; // one case, one pipeline; throws on failure
export function run(pipeline: Pipeline, code: string): Promise<RunResult>;
export const pipelines: Pipeline[]; // every pipeline file, in name order
export function behaviorCases(suite: string, cases: BehaviorCase[]): void;
```

- Cases live in `packages/silmaril/test/behavior/cases/*.test.ts`, one file per construct, and call `behaviorCases(suite, cases)`. It registers every case once per pipeline, under `describe('<suite> [<pipeline>]')`.
- A pipeline is a file in `packages/silmaril/test/behavior/pipelines/` with a `Pipeline` as its default export. The harness loads every `.ts` file there, so adding a pipeline needs no edit to `harness.ts` or to any case. The 0.4 pipeline is `pipelines/babel.ts`; `switch-to-v2` deletes it.
- A pipeline imports the runtime and compiler from source (`packages/silmaril/src`, `babel`, or the new compiler), never from `dist`.

## Behavior

- `log` is a free identifier. The harness passes it (and `flush`) as a parameter of the function that wraps the compiled module. Cases do not import it and it is not a global. Cases call `log(...)`, not `console.log`.
- `flush` is also a free identifier, so a case can `await flush()` at the top level of its code to separate phases. Top-level `await` is allowed. A case that needs to write from outside a boundary saves a setter in a module-level `let`.
- Imports: the harness parses the compiled source with `@babel/core`'s `parseSync` and replaces each import declaration by its source range, so text inside strings and comments is never touched. The table of modules is `silmaril` = `Pipeline.runtime`, `silmaril/store` = `{ default: Store }` from `packages/silmaril/store`, merged with `Pipeline.modules` (which wins). A default import reads the `default` key, named imports read their keys, a namespace import is the whole entry. Any other specifier throws. Supported: default, named (with `as`), namespace, combined (`import S, * as ns`), side-effect imports, and several imports on one line. `export` and dynamic `import()` throw a clear error.
- Timers: `run` installs vitest fake timers before compiling and `flush()` drives them with `vi.runAllTimersAsync()`. Runtime code that uses `setTimeout` or microtasks is flushed by `flush()`. `run` calls `flush()` once after the code ends, so a case that never awaits still sees its scheduled effects. A pipeline must not need real time.
- `compile` may be async. The harness awaits it.
- A case never asserts on compiled code. The only observable is the sequence of `log` calls.
- Expected failure: `CaseOptions.xfail` lists pipeline names. For those pipelines the case is a normal test and its title ends with ` (xfail)`. Errors from compiling or running fail it. It asserts that the logs differ from `logs` and fails with `now passes: remove the pipeline from xfail` once they match. When a pipeline gains a behavior, remove its name from `xfail`. For other pipelines the case is a normal test.
- Concurrency: fake timers are global, so `run` must not be called concurrently. `behaviorCases` registers each suite with `{ concurrent: false }` and restores real timers after each test.
- Limits of the harness: the case code is plain JS (no TypeScript syntax).

## Stub

None. `pipelines/babel.ts` is the reference pipeline.

## Contract tests

The suite itself: `pnpm --filter silmaril test` runs `test/behavior/cases/*.test.ts` (67 cases at v2, 4 marked xfail on `babel`, plus `harness.test.ts` self-tests for xfail and import linking).

## Changes

- v1: draft.
- v2: final shape. `compile` may return a promise; `RunResult.dispose` added; `log` and `flush` are free identifiers; imports are resolved by the harness; pipelines are discovered from `pipelines/*.ts`; `behaviorCases` and `BehaviorCase` added; `CaseOptions { xfail?: string[] }` settled.
- v2 (review fixes): `Pipeline.modules`, parser-based import rewrite, xfail fails on errors, `checkCase`, sequential suites.
