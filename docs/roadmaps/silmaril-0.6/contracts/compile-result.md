---
name: compile-result
version: 1
status: draft
defined_by: compile-api
---

# Contract: compile-result

## Purpose

The public shape of `compile()` in 0.6, and the internal hook that warning checks use. Users: every warning node, `unplugin-warnings`, `graph-output`, `live-sample-panels`, `docs-warnings-graph`.

## Interface

`packages/silmaril/compiler/index.ts` (public):

```ts
export type WarningCode =
  | 'in-place-mutation' // `user.name = x`, `user.n++`, `delete user.n` on a reactive variable
  | 'untracked-entry' // a `$` or `$sync` that tracks nothing and calls a function the compiler cannot follow
  | 'pattern-default' // a reactive read in a default of a declaration pattern
  | 'loop-local-read'; // a `$`, `$sync` or computed variable reads a variable declared in a loop or nested function and written after

export interface CompileWarning {
  code: WarningCode;
  /** One sentence: what does not happen, and how to fix it. No trailing location. */
  message: string;
  /** Same convention as CompileError: 1-based line, 0-based column, UTF-16 code units. */
  loc: SourceLocation;
  /** Same format as CompileError.frame. */
  frame: string;
}

export interface CompileOptions {
  filename: string;
  sourcemap?: boolean;
  /** Default false. When true, `result.graph` holds the text dump of the reactive graph. */
  graph?: boolean;
}

export interface CompileResult {
  code: string;
  map: SourceMap | null;
  /** Sorted by offset. Empty for a module that is returned unchanged. */
  warnings: CompileWarning[];
  /** The graph dump when `options.graph` is true and the module was compiled, else null. */
  graph: string | null;
}
```

`packages/silmaril/compiler/analysis/warnings/index.ts` (internal):

```ts
/** One check per file in this folder. A check reads the finished model and reports with `warn`. */
export type WarningCheck = (model: ModuleModel, warn: Warn) => void;
export type Warn = (
  code: WarningCode,
  message: string,
  node: { start: number },
) => void;

/** The registry. Each warning node appends its check here, one line. */
export const WARNING_CHECKS: WarningCheck[] = [];
```

## Behavior

- Checks run after `analyzeModel` and before codegen, on the original AST, and never change the model.
- A check never throws `CompileError`. Errors stay errors; warnings never stop a compile.
- Two reports of the same code at the same offset are kept once.
- `graph` is computed only when asked, so the default compile does no extra work.
- The compiled `code` and `map` do not depend on `graph` or on the warnings.

## Stub

`compile-api` ships the registry empty and `graph` always null. Warning nodes append to the registry. `graph-output` fills `graph`.

## Contract tests

`packages/silmaril/test/compiler/analysis/compile.test.ts`: an unchanged module returns `warnings: []` and `graph: null`; a compiled module with no warning case returns `warnings: []`; a test-only check pushed onto `WARNING_CHECKS` comes back with `loc` and `frame` matching `CompileError` for the same offset.

## Changes

- v1: initial.
