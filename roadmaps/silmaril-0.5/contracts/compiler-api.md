---
name: compiler-api
version: 1
status: draft
defined_by: compiler-infra-spike
---

# Contract: compiler-api

## Purpose

The public API of `silmaril/compiler` and the internal analysis API inside `packages/silmaril/compiler/`. `compiler-core` implements the analysis, `codegen-core` and `codegen-extras` build on it, `switch-to-v2` wires `silmaril/unplugin` to it, and `runnable-samples` calls it in the browser.

## Interface

Draft, frozen by `compiler-infra-spike`:

```ts
// silmaril/compiler
export interface CompileOptions {
  filename: string; // used for the language (.ts, .tsx, .js, .jsx) and in source maps
  sourcemap?: boolean; // default true
}

export interface CompileResult {
  code: string;
  map: SourceMap | null; // magic-string SourceMap (v3)
}

export class CompileError extends Error {
  loc: { line: number; column: number };
  frame: string; // code frame for the error
}

export function compile(code: string, options: CompileOptions): CompileResult;
```

- Runs in Node.js and in the browser (oxc-parser wasm binding). The wasm binding loads asynchronously; the spike decides between an `init(): Promise<void>` export, an async `compile`, or a top-level await in the browser entry.
- `map` must convert to what `silmaril/unplugin` returns (`SourceMapCompact`), for example through `JSON.parse(map.toString())`. The spike fixes the exact type.
- The spike decides the tsdown `platform` of the `compiler` entry (`neutral` if it must run in the browser).
- Returns the input unchanged (with `map: null`) when the module does not import `silmaril`.

The internal analysis API (parse result, scopes and bindings, the silmaril imports found, the reactive variables of each setup, calls to local functions) is defined by the spike in this file.

## Behavior

- Errors throw `CompileError` with a location. No error loses its location.
- TypeScript wrappers (`as`, `satisfies`, `!`, `<T>x`, instantiation expressions, parentheses) are seen through like `unwrap-node.ts` does today.

## Stub

None. `compiler-core` is the first implementation.

## Contract tests

`packages/silmaril/test/compiler/` (written by `compiler-core`).

## Changes

- v1: draft.
