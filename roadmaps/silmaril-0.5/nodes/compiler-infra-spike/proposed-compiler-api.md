---
name: compiler-api
version: 2
status: proposed
defined_by: compiler-infra-spike
---

# Contract: compiler-api (proposed v2)

Replacement for `contracts/compiler-api.md` v1. The orchestrator copies it over the contract if accepted. Evidence is in `nodes/compiler-infra-spike/outcome.md` and the prototype in `nodes/compiler-infra-spike/proto/`.

## Purpose

The public API of `silmaril/compiler` and the internal analysis API inside `packages/silmaril/compiler/`. `compiler-core` implements the analysis, `codegen-core` and `codegen-extras` build on it, `switch-to-v2` wires `silmaril/unplugin` to it, and `runnable-samples` calls it in the browser.

## Interface

```ts
// silmaril/compiler
export interface CompileOptions {
  /** Picks the language (.js, .jsx, .ts, .tsx, also .mjs/.cjs/.mts/.cts) and names the source in the map. */
  filename: string;
  /** Default true. */
  sourcemap?: boolean;
}

/** Source map v3. Assignable to unplugin's SourceMapCompact without a cast. */
export interface SourceMap {
  version: number;
  file?: string;
  sources: string[];
  sourcesContent?: (string | null)[];
  names: string[];
  mappings: string;
}

export interface CompileResult {
  code: string;
  map: SourceMap | null;
}

export class CompileError extends Error {
  /** 1-based line, 0-based column, in UTF-16 code units. */
  loc: { line: number; column: number };
  /** The source line and a caret under the column. */
  frame: string;
}

/** Synchronous in Node.js and in the browser. */
export function compile(code: string, options: CompileOptions): CompileResult;
```

### Decided open points

1. **Async loading of the wasm binding: no `init()` and no async `compile`.** In Node.js, oxc-parser loads its native binding synchronously. In the browser, `oxc-parser`'s `browser` export imports `@oxc-parser/binding-wasm32-wasip1`, and that module fetches and instantiates the wasm with a top-level await. So the async step is the module import itself. Browser callers write `const { compile } = await import('silmaril/compiler')`, or import it statically in an ES module graph. `compile` is synchronous after that. Requirements on the browser side:
   - The page's package depends on `@oxc-parser/binding-wasm32-wasip1` at the same version as `oxc-parser`. silmaril does not depend on it, so Node users do not download 1.4 MB of wasm.
   - `@napi-rs/wasm-runtime` is pinned to `1.2.5` (pnpm `overrides`). Version 1.2.6 does not accept the `@emnapi/*@2.0.0-alpha.6` that the bindings pin, the package manager installs emnapi 1.x beside it, and loading fails with `this.bridge.setLastError is not a function`. Remove the pin once the bindings and the runtime agree again.
   - Vite: list `oxc-parser` and the binding in `optimizeDeps.exclude`. The build target must allow top-level await (es2022 or later).
   - No cross-origin isolation (COOP/COEP) is needed.
2. **Source map type: silmaril's own `SourceMap` interface above.** The implementation returns magic-string's `SourceMap` instance (from `generateMap({ source: filename, includeContent: true, hires: 'boundary' })`). It has those fields, plus `toString()` and `toUrl()`. The public `.d.ts` does not name magic-string. `silmaril/unplugin` returns `result.map` as is. `JSON.stringify(map)` gives the JSON.
3. **tsdown platform of the `compiler` entry: `neutral`.** `compiler/` must not import `node:*` modules. `oxc-parser` and `magic-string` stay external, so the consumer's bundler picks `oxc-parser`'s `browser` export. The other entries keep `platform: 'node'`. If tsdown's `exports: true` does not combine two config objects cleanly, keep one config with `platform: 'node'`: the prototype shows the compiler works in the browser as long as `compiler/` has no Node imports. A lint rule or a test that greps `compiler/` for `node:` keeps this true.

### Behavior of `compile`

- Returns `{ code, map: null }` with the input unchanged when the module does not import a tracked name from `silmaril`, or has no `$$`/`$composable` setup.
- Keeps TypeScript and JSX syntax as it is. It edits text with magic-string. It does not print the AST, so formatting and comments are kept.
- Generated local names come from `createUid` (below) and never collide with a name declared or referenced anywhere in the module.
- The hooks are imported with a new `import { $$context as _$$context, ... } from 'silmaril'` added at the top of the module.

## Internal analysis API (`packages/silmaril/compiler/`)

Types are from `@oxc-project/types` (re-exported by `oxc-parser`). All offsets are UTF-16 offsets into the original code, which is what magic-string uses.

```ts
import type * as oxc from 'oxc-parser';

// parse.ts
export type Lang = 'js' | 'jsx' | 'ts' | 'tsx';
export interface ParsedModule {
  code: string;
  filename: string;
  lang: Lang;
  program: oxc.Program;
  comments: oxc.Comment[];
}
/** parseSync with sourceType 'module' and preserveParens true. Throws CompileError on the first error. */
export function parseModule(code: string, filename: string): ParsedModule;
export function getLang(filename: string): Lang;

// unwrap.ts
/** Sees through ParenthesizedExpression, as, satisfies, !, <T>x and x<T>. */
export function unwrap(node: oxc.Node): oxc.Node;

// walk.ts
/** Visits nodes in source order with their parent. Return false to skip the children. */
export function visit(
  node: oxc.Node,
  enter: (node: oxc.Node, parent: oxc.Node | null) => boolean | void,
): void;

// scope.ts
export type ScopeKind = 'module' | 'function' | 'block' | 'class' | 'catch';
export type BindingKind =
  | 'var'
  | 'let'
  | 'const'
  | 'using'
  | 'param'
  | 'function'
  | 'class'
  | 'import'
  | 'catch'
  | 'enum'
  | 'namespace'
  | 'import-equals';

export interface Scope {
  kind: ScopeKind;
  /** Program, function, BlockStatement, for/switch statement, class, CatchClause. */
  node: oxc.Node;
  parent: Scope | null;
  /** Nearest function, static block, namespace or module scope: where `var` goes. */
  functionScope: Scope;
  bindings: Map<string, Binding>;
  children: Scope[];
}

export interface Binding {
  name: string;
  kind: BindingKind;
  /** The declaring identifier. The first one wins on redeclaration. */
  identifier: oxc.BindingIdentifier;
  /** VariableDeclarator, Function, Class, ImportSpecifier, CatchClause, TSEnumDeclaration... */
  declaration: oxc.Node;
  scope: Scope;
  references: Reference[];
}

export interface Reference {
  identifier: oxc.IdentifierReference | oxc.JSXIdentifier;
  scope: Scope;
  /** null for a global. */
  binding: Binding | null;
  read: boolean;
  write: boolean;
  /** For a write: the AssignmentExpression, UpdateExpression, or for-in/of statement. */
  writeExpression: oxc.Node | null;
}

export interface ScopeInfo {
  root: Scope;
  scopes: Map<oxc.Node, Scope>;
  references: Reference[];
  referenceOf: Map<oxc.Node, Reference>;
  declarationOf: Map<oxc.Node, Binding>;
  /** Every declared or referenced name, globals included. */
  names: Set<string>;
}

/** One walk. Types are skipped. References resolve after the walk, so hoisting works. */
export function analyzeScopes(program: oxc.Program): ScopeInfo;
/** Name lookup from a scope, for names that have no identifier node. */
export function resolveName(scope: Scope, name: string): Binding | null;
/** Babel's generateUidIdentifier: `_hint`, `_hint2`... Reserves the name it returns. */
export function createUid(names: Set<string>): (hint: string) => string;

// comments.ts
/** True when a `/* $skip *\/` or `// $skip` comment sits right before the node (only whitespace between). */
export function hasSkipComment(module: ParsedModule, node: oxc.Node): boolean;

// silmaril.ts
export type TrackedName =
  | '$$'
  | '$composable'
  | '$'
  | '$sync'
  | '$store'
  | 'onMount'
  | 'onDestroy';
/** The local bindings of each tracked import from 'silmaril'. Type-only imports are left out. */
export type SilmarilImports = Map<TrackedName, Set<Binding>>;
export function findSilmarilImports(
  module: ParsedModule,
  info: ScopeInfo,
): SilmarilImports;
/** The tracked name a call's callee (after unwrap) resolves to, if any. */
export function trackedCallee(
  call: oxc.CallExpression,
  info: ScopeInfo,
  imports: SilmarilImports,
): TrackedName | null;

export interface ReactiveVariable {
  binding: Binding;
  declarator: oxc.VariableDeclarator;
  kind: 'let' | 'const' | 'var';
  /** 'store' when the init is a `$store(...)` call. 'derived' when the init reads another reactive variable. */
  source: 'state' | 'derived' | 'store';
}

export interface LocalCall {
  call: oxc.CallExpression;
  /** A function declared in the setup (declaration or const arrow/function expression). */
  callee: Binding;
}

export interface Setup {
  kind: '$$' | '$composable';
  call: oxc.CallExpression;
  fn: oxc.ArrowFunctionExpression | oxc.Function;
  scope: Scope;
  /** The enclosing setup, for setups nested in setups. */
  parent: Setup | null;
  /** let/const/var declared in the setup function and its blocks, not in nested functions. */
  variables: Map<Binding, ReactiveVariable>;
  /** Calls of tracked names ($, $sync, onMount, onDestroy, nested $$) whose nearest function is `fn`. */
  tracked: { name: TrackedName; call: oxc.CallExpression }[];
  /** Calls to functions declared in this setup. */
  localCalls: LocalCall[];
}

/** Every `$$`/`$composable` call with a function argument. Throws CompileError on a bad argument. */
export function findSetups(
  module: ParsedModule,
  info: ScopeInfo,
  imports: SilmarilImports,
): Setup[];

export interface ModuleAnalysis {
  module: ParsedModule;
  scopes: ScopeInfo;
  imports: SilmarilImports;
  setups: Setup[];
}
/** parse + scopes + imports + setups. Returns null when the module does not import silmaril. */
export function analyzeModule(
  code: string,
  filename: string,
): ModuleAnalysis | null;
```

### Rules for the code generators

- Analysis runs once, on the original AST. Edits go to one `MagicString`. Nothing re-analyzes the output, so there is no `scope.crawl()` step. A generator that needs a new name calls `createUid`. A generator that inserts a declaration knows it already and does not need to look it up.
- To wrap a node in `f(ctx, <node>)`: `appendLeft(node.start, 'f(ctx, ')` and `prependRight(node.end, ')')`, with outer nodes handled before inner ones (sort by start, then by length, longest first). Nested wraps then come out in the right order.
- Text inserted by a generator is never walked, so Babel's `path.skip()` and the `/*$skip*/` markers on generated nodes are not needed. The user-written `$skip` comment still works through `hasSkipComment`.
- `x = y = 1` with two reactive variables wraps both writes. The Babel plugin wrapped only the outer one, because `skip()` stopped it from visiting the inner one.

## Behavior

- Errors throw `CompileError` with a location. No error loses its location. Parse errors use the first oxc error label.
- TypeScript wrappers (`as`, `satisfies`, `!`, `<T>x`, instantiation expressions, parentheses) are seen through by `unwrap`, in callees, in setup arguments and in assignment targets (`(x as number) = 1` is a write of `x`).
- Names inside types are not references: `let x: Foo` does not read `Foo`, and `typeof x` in a type does not read `x`.
- TS enums, namespaces, `import x = require()`, `declare const` and parameter properties declare bindings. Overload signatures and `declare function` do not.
- JSX: `<Foo>`, `<Foo.Bar>` and `<$x>` are references. `<div>` and `<my-element>` are not. Closing tags are not counted twice.

## Stub

None. `compiler-core` is the first implementation. `nodes/compiler-infra-spike/proto/scope.ts` is a working start for `scope.ts` and is tested against Babel.

## Contract tests

`packages/silmaril/test/compiler/` (written by `compiler-core`). Port the checks from `nodes/compiler-infra-spike/proto/test.ts`: Babel differential on a fixture, shadowing, generated names, UTF-16 offsets, source map round trip.

## Dependencies

- `oxc-parser` (dependency of `silmaril`, compiler entry only). 0.155.0 tested.
- `magic-string` (dependency). 1.4.4 tested. It is ESM only, which fits.
- Browser pages (`website-skeleton`, `runnable-samples`): `@oxc-parser/binding-wasm32-wasip1` at the oxc-parser version, plus the `@napi-rs/wasm-runtime` 1.2.5 override.

## Changes

- v1: draft.
- v2 (proposed by compiler-infra-spike): decided the three open points (sync `compile` with top-level await in the binding, own `SourceMap` interface, `neutral` platform). Filled in the internal analysis API.
