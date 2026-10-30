---
name: compiler-api
version: 2
status: proposed
defined_by: compiler-infra-spike
---

# Contract: compiler-api (proposed v2)

Replacement for `contracts/compiler-api.md` v1. The orchestrator copies it over the contract if accepted. Evidence is in `nodes/compiler-infra-spike/outcome.md` and the prototype in `nodes/compiler-infra-spike/proto/`.

## Purpose

The public API of `silmaril/compiler`, and the internal API between the analysis (`compiler-core`) and the code generators (`codegen-core`, `codegen-extras`) inside `packages/silmaril/compiler/`. `switch-to-v2` wires `silmaril/unplugin` to it, and `runnable-samples` calls it in the browser.

The output of the compiler is defined by the `reactivity-runtime` contract, version 4 (PR #8 at bc5407d, `nodes/reactivity-adr/proposed-reactivity-runtime.md` until it is frozen), and its fixtures in `packages/silmaril/test/runtime/fixtures/`. This contract does not repeat its rules. It says how the compiler computes them and how it edits the text. Where the two disagree, the runtime contract wins and this one gets a change request.

## Public interface

```ts
// silmaril/compiler
export interface CompileOptions {
  /** Picks the language (.js and .jsx parse as JSX; .ts, .tsx; also .mjs/.cjs/.mts/.cts) and names the source in the map. */
  filename: string;
  /** Default true. */
  sourcemap?: boolean;
}

/** Source map v3. Assignable to unplugin's SourceMapCompact without a cast. */
export interface SourceMap {
  version: number;
  /** The generated file: the base name of `filename`. */
  file?: string;
  /** Relative to `file`, so the base name of `filename`. */
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

/**
 * Resolves when `compile` can run. Today it resolves at once: the parser is ready when
 * the module has loaded. Callers that may run in a browser await it before the first
 * compile, so a later parser that loads its wasm on demand does not change the API.
 */
export function ready(): Promise<void>;
```

### Decisions

1. **Synchronous `compile`, plus a no-op `ready()`.** In Node.js, oxc-parser loads its native binding synchronously. In the browser, the `browser` export of `oxc-parser` imports `@oxc-parser/binding-wasm32-wasip1`, which instantiates the wasm with a top-level await. So today the async step is the module import, and `compile` is synchronous after it. That depends on an internal detail of the binding, and a static import puts the top-level await in the importer's module graph. `ready()` gives callers a stable place to wait, and later a place to catch a load failure. It is exported now so that change is not breaking. It returns the same resolved promise on every call.
2. **`SourceMap` is silmaril's own interface.** The value is magic-string's `SourceMap` (`generateMap({ source: filename, file: filename, includeContent: true, hires: 'boundary' })`), which also has `toString()` and `toUrl()`. The `.d.ts` does not name magic-string. `file` names the generated file. magic-string keeps the base name, and makes `sources` relative to `file`, so both are the base name of `filename` (tested). Bundlers resolve `sources` against the module's folder, which is the same folder.
3. **Pinning.** `oxc-parser` is an exact dependency (`"0.155.0"`, or the version `compiler-core` installs, but exact). `@oxc-parser/binding-wasm32-wasip1` is an optional peer dependency at the same exact version (`peerDependenciesMeta: { optional: true }`), so Node users do not download 1.4 MB of wasm, and a page that installs it gets a warning when the versions differ. A Renovate or Dependabot rule bumps the two together. `magic-string` stays `^1.4.4`: the edit rules need `update()` and `appendLeft`/`prependRight`, which 1.x has.
4. **One tsdown config with `platform: 'node'`, plus a test.** `oxc-parser` and `magic-string` stay external, so `platform` changes nothing in the compiler chunk except how `node:` built-ins resolve. The browser works as long as `compiler/` imports no `node:` module. `compiler-core` adds `test/compiler/analysis/no-node-imports.test.ts`, which reads every file under `compiler/` and fails on `from 'node:` or `import('node:`. `proto/test.ts` has the same check. A second `neutral` config is not needed, and its interaction with `exports: true` is untested.

Browser requirements (unchanged from the first spike):

- The page depends on `@oxc-parser/binding-wasm32-wasip1` at the `oxc-parser` version.
- `@napi-rs/wasm-runtime` is pinned to `1.2.5` (pnpm `overrides`). 1.2.6 does not accept the `@emnapi/*@2.0.0-alpha.6` that the oxc 0.155 bindings pin, and the load fails with `this.bridge.setLastError is not a function`. Remove the pin once they agree.
- Vite: `oxc-parser` and the binding in `optimizeDeps.exclude`, and a build target with top-level await (es2022 or later). No cross-origin isolation is needed.

### Behavior of `compile`

- Returns `{ code, map: null }`, with the input unchanged, when the module has no named import of a compile-time name (`$$`, `$`, `$sync`, `$skip`, `$store`, `$composable`, `onMount`, `onDestroy`) from `'silmaril'`. A fast text check for `silmaril` comes first.
- Otherwise it runs every check of "Compile errors" below, even when the module has no setup, and emits the output of the `reactivity-runtime` contract: compiled forms, names, temps, imports and graphs.
- It edits the text with magic-string. It never prints the AST, so TypeScript, JSX, comments and formatting stay as written.
- Errors throw `CompileError` with a location. Parse errors use the first oxc error label.

## File layout

```text
packages/silmaril/compiler/
  index.ts             compile, ready and the public types           compiler-core
  errors.ts            CompileError, code frames                    compiler-core
  source.ts            parseModule, getLang                         compiler-core
  analysis/walk.ts     visit, childNodes, unwrap                    compiler-core
  analysis/scope.ts    analyzeScopes, resolveName, createUid        compiler-core
  analysis/imports.ts  findSilmarilImports                          compiler-core
  analysis/model.ts    analyzeModel and the model types             compiler-core
  analysis/reads.ts    reads, local functions, fixed points         compiler-core
  analysis/writes.ts   write sites                                  compiler-core
  analysis/checks.ts   compile errors that are not found elsewhere  compiler-core
  analysis/index.ts    analyzeModule                                compiler-core
  codegen/index.ts     generate(s, model): the walk and dispatch    codegen-core (codegen-extras adds calls)
  codegen/*.ts         variables, writes, entries, imports, graphs  codegen-core
  codegen/extras/*.ts  $store, $composable, lifecycles, $skip       codegen-extras
packages/silmaril/test/compiler/
  analysis/**          scope builder, model, errors, no-node-imports compiler-core
  codegen/**           fixture text, logs and source maps            codegen-core
  codegen/extras/**    the same for the extras                       codegen-extras
```

The analysis covers every construct, the extras included: their compile errors, slots (`$store`), entries (write-backs) and scope bindings (lifecycles) are part of the model. `codegen-extras` only emits. `index.ts` calls `analyzeModule`, then `generate` once `codegen/index.ts` exists. Until then it returns the input unchanged.

## Internal analysis API

Types are from `@oxc-project/types` (re-exported by `oxc-parser`). All offsets are UTF-16 offsets into the original code, which is what magic-string uses. Analysis runs once, on the original AST, before any edit. Codegen reads these results only.

### Parsing and walking

```ts
// source.ts
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

// analysis/walk.ts
/** Sees through ParenthesizedExpression, as, satisfies, !, <T>x and x<T>. */
export function unwrap(node: oxc.Node): oxc.Node;
/**
 * Child nodes in source order (sorted by start). Type-only keys (typeAnnotation,
 * typeParameters, typeArguments, returnType, implements, superTypeArguments) are left
 * out, and a shorthand property yields its value only: its key is a second node with
 * the same span, and a pass that edits by span would edit twice.
 */
export function childNodes(node: oxc.Node): oxc.Node[];
/** Pre-order walk over childNodes, with the parent. Return false to skip the children. */
export function visit(
  node: oxc.Node,
  enter: (node: oxc.Node, parent: oxc.Node | null) => boolean | void,
): void;
```

### Scopes and references

```ts
// analysis/scope.ts
export type ScopeKind =
  | 'module'
  | 'function'
  | 'params' // the parameters of a function that has parameter expressions
  | 'block'
  | 'class'
  | 'catch';
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
  /** The declaring identifier. The first one wins on redeclaration (`var x; var x`). */
  identifier: oxc.BindingIdentifier;
  /** VariableDeclarator, Function, Class, ImportSpecifier, CatchClause, TSEnumDeclaration... */
  declaration: oxc.Node;
  scope: Scope;
  references: Reference[];
}

/** Where a reference sits. Codegen needs it to replace the identifier with an expression. */
export type ReferenceContext =
  | 'plain' // an expression position
  | 'shorthand' // `{ x }`, or `{ x }` / `{ x = 1 }` in an assignment pattern: print `x: <expr>`
  | 'jsx' // `<X />`, or the object of `<X.Y />`
  | 'export'; // `export { x }`

export interface Reference {
  identifier: oxc.IdentifierReference | oxc.JSXIdentifier;
  context: ReferenceContext;
  scope: Scope;
  /** null for a global. */
  binding: Binding | null;
  /** False for a write target, including the target of `x += 1` and `x++`. */
  read: boolean;
  write: boolean;
  /** For a write: the AssignmentExpression, UpdateExpression, or for-in/of statement. */
  writeExpression: oxc.Node | null;
}
```

`read` is the JS meaning: `x += 1` reads `x`. The runtime contract's "read" excludes every write target, so the model uses `!write`, not `read`.

```ts
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
export function resolveName(scope: Scope, name: string): Binding | null;
/** A name that matches no name in `names` (see "Names"). Reserves it. */
export function createUid(names: Set<string>): (hint: string) => string;
```

### Imports

```ts
// analysis/imports.ts
export type TrackedName =
  | '$$'
  | '$composable'
  | '$'
  | '$sync'
  | '$skip'
  | '$store'
  | 'onMount'
  | 'onDestroy';

export interface SilmarilImports {
  /** Named import declarations from 'silmaril', in source order (not `import type`). */
  declarations: oxc.ImportDeclaration[];
  /** The local binding of each compile-time name, aliases included. */
  tracked: Map<Binding, TrackedName>;
  /** The specifiers the import rewrite removes. */
  compileTime: Set<oxc.ImportSpecifier>;
}
export function findSilmarilImports(
  program: oxc.Program,
  declarationOf: ScopeInfo['declarationOf'],
): SilmarilImports;
```

Namespace and default imports of `'silmaril'` are not tracked, and calls through them are not compiled (runtime contract "Imports").

### The reactive model

```ts
// analysis/model.ts
export type ReactiveScopeKind =
  | 'root'
  | 'composable'
  | 'sync'
  | 'effect'
  | 'memo';

/** A scope of the runtime: a setup, or the child scope of one entry's runs. */
export interface ReactiveScope {
  kind: ReactiveScopeKind;
  /**
   * root, composable: the setup function. sync, effect with a function argument: the
   * entry body. memo, and sync or effect with another argument: the expression that
   * codegen wraps in `() =>`.
   */
  node: oxc.Node;
  /** True for a setup function or an entry body: the functions that can declare slots and entries. */
  isBody: boolean;
  /** The `$$` or `$composable` call of a setup. */
  call: oxc.CallExpression | null;
  /** The scope that holds `entry`. null for every setup, nested `$$` and `$composable` included. */
  parent: ReactiveScope | null;
  /** The entry whose runs make this scope. null for a setup. */
  entry: Entry | null;
  /** The setup of this setup tree. */
  tree: ReactiveScope;
  /** 0 for a setup in no other setup tree, +1 per enclosing setup tree. */
  setupDepth: number;
  /** Index = slot number. */
  slots: Slot[];
  /** Index = entry id. */
  entries: Entry[];
  /** graph[slot] = sorted refs. null when the compiled call takes no graph (an entry body with no slots, a memo, an expression entry). */
  graph: Ref[][] | null;
  /** The parameter name codegen prints, and whether anything uses it. */
  param: string;
  paramUsed: boolean;
  /** The module-level constant that holds `graph`. */
  graphName: string | null;
}

/** Same shape as the runtime's Ref. */
export type Ref = number | number[];

export type EntryKind = 'memo' | 'store-writeback' | 'sync' | 'effect';

export interface Entry {
  id: number;
  kind: EntryKind;
  /** The VariableDeclarator of a memo or write-back, the `$`/`$sync` call otherwise. */
  node: oxc.Node;
  /** The scope that registers the entry. */
  scope: ReactiveScope;
  /** Memo: the output slot, -1 for a destructuring memo. Write-back: its slot. Else null. */
  slot: number | null;
  /** The bindings with a slot that the entry reads (runtime contract "Reads"). */
  reads: Set<Binding>;
  /** The scope of each run. null for a write-back, which never runs a function. */
  child: ReactiveScope | null;
}

export interface Slot {
  index: number;
  scope: ReactiveScope;
  binding: Binding;
  declarator: SlotDeclarator;
}

export interface SlotDeclarator {
  /** state: rule 1 only. memo: rule 2 (also when rule 1 holds). store: rule 3. */
  kind: 'state' | 'memo' | 'store';
  declaration: oxc.VariableDeclaration;
  declarator: oxc.VariableDeclarator;
  scope: ReactiveScope;
  /** One per bound name, in source order. */
  slots: Slot[];
  /** The memo or write-back entry. */
  entry: Entry | null;
  /** The `$store(...)` call. */
  store: oxc.CallExpression | null;
}

export type WriteKind =
  | 'assign' // x = v
  | 'compound' // x op= v
  | 'logical' // x ||= v, x &&= v, x ??= v
  | 'update' // x++, --x
  | 'destructure' // P = e
  | 'for' // for (x of e), for (P in e), for await
  | 'redeclare'; // a second `var x = v` of a slotted var

export interface WriteTarget {
  identifier: oxc.IdentifierReference | oxc.BindingIdentifier;
  binding: Binding;
  slot: Slot;
  /** `{ x }` or `{ x = 1 }`: the target prints as `x: <temp>`. */
  shorthand: boolean;
}

export interface WriteSite {
  kind: WriteKind;
  /** AssignmentExpression, UpdateExpression, ForIn/ForOfStatement, or the VariableDeclarator of a redeclare. */
  node: oxc.Node;
  /** The target as written: the left side, the update argument, the loop head, or the declarator id. */
  pattern: oxc.Node;
  /** The targets that have a slot, in source order. Other targets (plain locals, members) stay as written. */
  targets: WriteTarget[];
  /** A destructuring write that is a whole expression statement in a statement list. */
  statement: boolean;
  /** The nearest function, or the class field whose initializer holds the site: it declares the temps. */
  fn: oxc.Function | oxc.ArrowFunctionExpression;
}

/** A call that binds to a scope at run time. */
export interface ScopeBinding {
  call: oxc.CallExpression;
  /** 'composable-call': a call by name of a local `const f = $composable(...)`. */
  name: 'onMount' | 'onDestroy' | 'composable-call';
  /** onMount and onDestroy print `scope.param`. A composable call is not edited: the runtime uses the running scope, which is this one. */
  scope: ReactiveScope;
}

export interface ModuleModel {
  parsed: ParsedModule;
  info: ScopeInfo;
  imports: SilmarilImports;
  /** Every reactive scope, in source order of `node`. */
  scopes: ReactiveScope[];
  setupOf: Map<oxc.CallExpression, ReactiveScope>;
  entryOfCall: Map<oxc.CallExpression, Entry>;
  /** Slot of a binding, or nothing for a plain local. */
  slotOf: Map<Binding, Slot>;
  declarators: Map<oxc.VariableDeclarator, SlotDeclarator>;
  /** Declarations that hold a slot declarator or a redeclare, with those declarators. */
  declarations: Map<oxc.VariableDeclaration, oxc.VariableDeclarator[]>;
  /** In source order. */
  writes: WriteSite[];
  writeOf: Map<oxc.Node, WriteSite>;
  /** `$skip(...)` calls. Reads inside their argument are not tracked; reads and writes there still compile. */
  skips: oxc.CallExpression[];
  bindings: ScopeBinding[];
  bindingOf: Map<oxc.CallExpression, ScopeBinding>;
  /** Every call of a compile-time name, with its imported name. */
  trackedCalls: Map<oxc.CallExpression, TrackedName>;
}

// analysis/index.ts
/** parse + scopes + imports + model. null when no compile-time name is imported. Throws CompileError. */
export function analyzeModule(
  code: string,
  filename: string,
): ModuleModel | null;
```

`slotOf(binding)` in the review is `model.slotOf.get(binding)`: it gives the scope and the slot number.

### How the model is computed

The order matters, because later steps use earlier results. `proto/model.ts` follows it.

1. **Compile-time references.** Every reference to a tracked binding must be the callee of a call, through parentheses and TS wrappers. Otherwise: `<name> can only be called.`
2. **Setup trees.** Each `$$` and `$composable` call, outer ones first, makes a setup scope (`root` or `composable`) with `parent: null`. The argument must be one function or arrow, block or expression body. The setup tree of a node is its nearest enclosing setup function.
3. **Entries.** Each `$`/`$sync` call, in source order (outer before inner), takes exactly one argument, no spread (`<name> can only accept a single argument`, the 0.4 text). Walk up from the call until a function. The call may sit in any expression, as in 0.4 (`on && $sync(...)`). The walk fails with `<name> must be called directly in a setup body.` at a function that is not a setup or an entry body (a nested function, or a parameter default), at the program, at a class field or static block, and at the argument of another `$`/`$sync` call (step 6 adds the memo initializers). It fails with `<name> cannot be called inside a loop.` when it passes a loop node on the way to an owner. A function argument makes a `sync`/`effect` scope with `isBody: true`, so calls inside it can be checked next.
4. **Other names.** `$skip`, `onMount` and `onDestroy` outside every setup tree fail. `$skip` and `$store` take exactly one argument (no spread). A `$store` call that is the whole initializer of a declarator with a pattern fails with `$store is only limited to identifiers.`; each other `$store` call must be the whole initializer (through wrappers) of a slot candidate (step 5), else `$store must initialize a variable of a setup body.` A comment whose trimmed text is `$skip`, inside a setup function, fails.
5. **Slot candidates.** The declarators of every setup declaration of each scope body with a block body, one per declarator: a `let`, `const` or `var` reached through blocks, `if`, `try`/`catch`/`finally`, `switch` cases and labels, but not through a loop or a nested function. A later `var` of a name that already has a candidate is not a candidate: it becomes a `redeclare` write if it has an initializer, and prints nothing otherwise. Initializers that are a class expression, `$$` or `$composable` call are never memos. A function or arrow initializer is a memo when it reads a slot (v4, fixture `function-memo`).
6. **Slots, to a fixed point.** Rule 1 (a `let`/`var` with any write reference, or a redeclare with an initializer) and rule 3 (`$store`) give slots first. Then rule 2 repeats until nothing changes: a candidate whose initializer reads a slot becomes a memo and gets slots. All names of a declarator get slots together. Slots are numbered per scope in source order of the declarators.
7. **Entries.** Per scope body: memos and `let`/`var` write-backs in source order, then `$sync` calls, then `$` calls. A memo gets a `memo` child scope over its initializer. An expression entry gets a `sync`/`effect` child scope over its argument, with `isBody: false`.
8. **Reads.** See below.
9. **Graphs.** A setup always has a graph. An entry body has one when it has slots. For every entry `E` of the setup tree and every binding in `E.reads` whose slot `S` belongs to a scope of the same setup tree, `graph[S]` gets `E.id` when `E` is in the slot's scope, or `[e1, ..., eN, E.id]`, the entry ids from the slot's scope down to `E`'s scope. Reads of slots in another setup tree (a nested `$$` or `$composable` reading an outer slot) give no edge. Each list is sorted: numbers ascending, then paths in lexicographic order.
10. **Write sites.** Every `writeExpression` of a reference to a slotted binding, plus the redeclares. A target with a `const` binding fails (`Cannot assign to a constant.`). A site records the node that declares its temps: the nearest function, or the class field whose initializer holds the site (codegen wraps the field value in a called arrow). A write in a memo initializer is allowed (v4), so there is no check for it.
11. **JSX tags.** A read reference with `context: 'jsx'` to a slotted binding fails with `A reactive variable cannot be used as a JSX tag.`
12. **Scope bindings.** Each `onMount`/`onDestroy` call binds to the nearest reactive scope node around it, the call itself included (`$(onMount(f))` binds to the expression entry's child). That marks `paramUsed`. Calls of local composables are recorded the same way, for tests and docs. They need no edit.
13. **Names.** See "Names" below.

### Reads

`directReads(root, tree, skip)` walks `root` and collects, for each identifier reference with `!write` and a binding:

- the binding, when it has a slot;
- otherwise, when the identifier is the callee of a call (`f()`, `f?.()`, through wrappers) and the binding is a local function of the same setup tree, the binding as a call.

The walk does not enter `$`/`$sync` calls that are entries, `$skip(...)` calls, nested `$$` and `$composable` calls, or the nodes in `skip`. It does enter nested plain functions.

A **local function** is a binding with no slot that is never written, and whose declaration is a `function` declaration, or a `let`/`const`/`var` declarator with an identifier id and a function or arrow initializer, inside a setup tree. Anything else called by name is opaque: an imported function, a parameter, a member call, a written binding (it has a slot, so the call reads that slot instead, fixture `written-function`).

`readsOf(root)` is `directReads(root)` plus the direct reads of every local function reachable through the calls, following calls inside them (a worklist with a seen set, so recursion ends).

- A memo reads `readsOf(init)`. Rule 2 of the slots uses the same function.
- An expression entry reads `readsOf(argument)`.
- A function entry with child scope `C` reads `readsOf(body, skip = initializers of C's memos)`, then: each binding with a slot in `C` is removed, and if it is a memo of `C`, that memo's reads are added. Repeat until no slot of `C` is left. A memo of `C` that reads another memo of `C` brings that one's reads in the next round (fixtures `body-memo`, `child-memo-wasted`).
- A write-back reads its own slot (v4 "Reads").
- A function or arrow initializer that reads a slot is a memo, so a binding such as `const handler = () => count` has a slot and is not a local function.

### Names

- Generated names must not match any name in `info.names`. The prototype picks a prefix once per module: `$`, or `$_`, `$__`... until no user name starts with the prefix followed by `s`, `c`, `t` or `g` and then a digit, `_` or the end.
- Setup parameters: `<p>s` at setup depth 0, `<p>s<depth>` deeper. Entry child scopes: `<p>c` and the entry ids from the setup down, joined with `_` (`$c0`, `$c0_1`). Inside a nested setup tree: `<p>cs<depth>_<path>`. These names never shadow a generated name used inside them.
- Graphs: `<p>g0`, `<p>g1`... in source order of the scopes.
- Temps: `$t0`, `$t1`... with one counter for the module, so no temp shadows another. The prefix gets `_` until no user name is the prefix plus digits.
- Helpers: the export name, or the name followed by `_` until it is free, imported as `$$get as $$get_`.

### Compile errors

All of the runtime contract's table, raised during analysis:

| Case                                                                                                      | Message                                                            | Step |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ---- |
| a compile-time name used other than as a call                                                             | `<name> can only be called.`                                       | 1    |
| `$$` or `$composable` whose argument is not one function                                                  | `<name> must be called with a function.`                           | 2    |
| `$` or `$sync` in a loop of a scope body                                                                  | `<name> cannot be called inside a loop.`                           | 3    |
| `$` or `$sync` in a nested function, a memo initializer, another entry's argument, or outside every setup | `<name> must be called directly in a setup body.`                  | 3, 6 |
| `$` or `$sync` with other than one argument                                                               | `<name> can only accept a single argument`                         | 3    |
| `$skip` or `$store` with other than one argument                                                          | `<name> takes exactly one argument.`                               | 4    |
| `$skip`, `onMount` or `onDestroy` outside every setup tree                                                | `<name> must be used inside $$ or $composable.`                    | 4    |
| `$store` with a pattern binding                                                                           | `$store is only limited to identifiers.`                           | 4    |
| `$store` not the whole initializer of a setup declaration                                                 | `$store must initialize a variable of a setup body.`               | 4, 6 |
| `/* $skip */` (or `// $skip`) inside a setup tree                                                         | `The /* $skip */ comment is not supported. Use $skip(expression).` | 4    |
| a write to a `const` with a slot                                                                          | `Cannot assign to a constant.`                                     | 10   |
| a slot used as a JSX tag                                                                                  | `A reactive variable cannot be used as a JSX tag.`                 | 11   |

`<name>` is the local name, alias included. The error location is the call, the identifier or the comment.

## Rules for the code generators

Analysis has finished before the first edit. Generators read the model and edit one `MagicString`. Nothing re-reads the output, so there is no `scope.crawl()`. Inserted text is never walked, so Babel's `path.skip()` is not needed.

### Edit discipline

magic-string 1.4.4 has two traps, both reproduced in `proto/test.ts` ("magic-string traps the edit rules avoid"):

```text
appendRight(0, '(') then overwrite(0, 1, ...)  -> the '(' is lost
overwrite(0, 4) then overwrite(0, 1)           -> throws: cannot split a chunk that has already been edited
```

So:

1. **One pre-order walk** (`visit`). A node's edits are made before its children's. Outer nodes come first, so their inserts at a shared offset nest outside the inner ones.
2. **Replace with `s.update(start, end, text)`**, never `overwrite` or `remove`. `update` is `overwrite` with `contentOnly: true`: it keeps what was appended or prepended at the range's ends. To delete, `update` with `''`.
3. **Replaced ranges never overlap, and no other edit point falls strictly inside one.** magic-string would throw, or put the insert in the wrong place.
4. **Each identifier is edited once.** A write owns its targets and its operator range:
   - `x = v`, `x op= v`, `x ||= v`: replace `[node.start, node.right.start)` (the target and the operator), then `prependRight(node.end, ')')` or `'))'`. The right side is edited by its own nodes.
   - `x++`: replace the whole node.
   - a pattern: each slot target identifier is replaced by its temp (`key: $t1` when shorthand). Reads of an earlier target inside a later default or computed key are replaced by that target's temp. The write registers these in a `renamed` map before the walk reaches them.
   - the read pass replaces a reference only when it is not a write and not in `renamed`. It prints `$$get(<scope param>, <slot>)`, or `x: $$get(...)` for `context: 'shorthand'`.
5. **Insert at a node's start with `appendLeft`, at its end with `prependRight`.** Both attach to the neighbouring chunk outside the node, so replacing text inside the node keeps them. Done outer node first, the opening texts come out outer first, and the closing texts inner first.
6. **An insert added later that must wrap earlier inserts at the same offset uses `prependLeft` at the start and `appendRight` at the end.** The only case: giving an expression-bodied arrow a block for its temps (`{ let $t0; return ` ... `; }`), done after the walk.
7. **A zero-length range cannot be replaced.** For a declaration with no `;`, insert the closing text with `prependRight`.
8. Two inserts at one offset where one node ends and the next starts would come out in the wrong order (the second node's opening text before the first node's closing text). JS syntax puts a separator between such nodes in every construct the compiler edits, so this does not happen. A generator must not create it.

Source maps: replaced text maps to the start of its range, inserted text to its anchor, and untouched text keeps its own mapping (`hires: 'boundary'`). `proto/test.ts` checks that every identifier the compiler keeps maps back to the same name, on `tricky.tsx` and the 2,028-line file.

### Edits per construct

`sc` is the parameter of the scope that owns the slot or entry. All of these run in `proto/codegen.ts`.

| Construct                                  | Edits                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `$$(fn)` / `$composable(fn)`               | replace the callee with `$$root` / `$$composable`; `appendLeft(arg.start, '$g0, ')`; scope parameter: `appendLeft` after the `(` of the parameter list, `sc, ` before the first parameter, or `(sc, ` and `)` around a bare `x =>` parameter                                                                                                                                                                                       |
| setup declaration with slots               | one statement per declarator (inside a block, `if` branch or `case`; a declaration that is the bare body of `if (c) var a = 1, b = 2;` gets `{ }` around the split). The ranges between declarators (`let `, `, `, the final `;`) are replaced with the closing text of the previous declarator plus the opening text of the next. A declarator's opening range runs to its initializer, so `x = ` and type annotations go with it |
| `let x = v` (state)                        | opening `$$set(sc, k, `, closing `);`                                                                                                                                                                                                                                                                                                                                                                                              |
| `let x;` (slot)                            | the declarator range is replaced with nothing                                                                                                                                                                                                                                                                                                                                                                                      |
| `const y = e` (memo)                       | opening `$$memo(sc, n, k, () => ` (with `(` when `e` is an object literal or a sequence), closing `);`                                                                                                                                                                                                                                                                                                                             |
| `const { p, q } = e` (memo)                | opening `$$memo(sc, n, -1, () => { const `, the pattern and `= e` stay, closing `; $$set(sc, k, p); $$set(sc, j, q); });`                                                                                                                                                                                                                                                                                                          |
| `const x = $store(s)`                      | `[declaration start, s.start)` becomes `$$store(sc, k, `, `[s.end, init.end)` becomes nothing, closing `);` or `, n);`                                                                                                                                                                                                                                                                                                             |
| `let [a, b] = e` (slots, not a memo)       | opening nothing (or `(` for an object pattern), targets renamed, closing `; $$set(sc, k, $t0); $$set(sc, j, $t1);`                                                                                                                                                                                                                                                                                                                 |
| `$sync(expr)` / `$(expr)`                  | replace the callee; `appendLeft(arg.start, 'sc, n, () => ')`                                                                                                                                                                                                                                                                                                                                                                       |
| `$sync(fn)` / `$(fn)`                      | replace the callee; `appendLeft(arg.start, 'sc, n, ')`; the child parameter when used; `prependRight(arg.end, ', $g1')` when the body has slots                                                                                                                                                                                                                                                                                    |
| `onMount(f)` / `onDestroy(f)`              | replace the callee; `appendLeft(arg.start, 'sc, ')` with the bound scope                                                                                                                                                                                                                                                                                                                                                           |
| `$skip(e)`                                 | replace `[call.start, e.start)` with `(` and `[e.end, call.end)` with `)`                                                                                                                                                                                                                                                                                                                                                          |
| `P = e` as a statement in a statement list | rename targets; `prependRight(statement.end, ' $$set(...); ...;')`                                                                                                                                                                                                                                                                                                                                                                 |
| `P = e` elsewhere                          | rename targets; `appendLeft(node.start, '(')`, `appendLeft(e.start, '$t0 = ')`, `prependRight(node.end, ', $$set(...), ..., $t0)')`. `$t0` is taken before the target temps                                                                                                                                                                                                                                                        |
| `for (x of e)`                             | replace the head target with `const $t0`; `appendLeft(body.start + 1, ' $$set(sc, k, $t0);')`, or wrap a non-block body in `{ ... }`                                                                                                                                                                                                                                                                                               |
| `for (P of e)`                             | rename the targets in place: `for ([$t1, $t2] of e) { $$set(...); body }` (the v4 form)                                                                                                                                                                                                                                                                                                                                            |
| temps                                      | after the walk, `let $t0, ...;` at the start of the nearest function body, after its directives. For a class field initializer: `prependLeft(value.start, '(() => { let ...; return ')` and `appendRight(value.end, '; })()')`                                                                                                                                                                                                     |
| imports                                    | the first named `'silmaril'` import is replaced by `import { <helpers in export-table order>, <kept specifiers> } from 'silmaril';`. Other named `'silmaril'` imports lose their compile-time specifiers, or are replaced by nothing                                                                                                                                                                                               |
| graphs                                     | `appendLeft(lastImport.end, '\n\nconst $g0 = [...];')`, after the import rewrite. Trailing empty lists are left out                                                                                                                                                                                                                                                                                                                |

## Behavior of the scope builder

- TypeScript wrappers (`as`, `satisfies`, `!`, `<T>x`, instantiation expressions, parentheses) are seen through by `unwrap`, in callees, in setup arguments and in assignment targets (`(x as number) = 1` is a write of `x`).
- Names inside types are not references: `let x: Foo` does not read `Foo`, and `typeof x` in a type does not read `x`.
- TS enums, namespaces (qualified ones too: `namespace A.B {}` declares `A` and walks the body), `import x = require()`, `declare const` and parameter properties declare bindings. Overload signatures and `declare function` do not.
- A function with parameter expressions (defaults, computed keys in parameter patterns) gets a `params` scope for its parameters and a separate `function` scope for its body. So in `let x = 1; function f(a = x) { let x = 2; }` the default reads the outer `x`. Babel resolves it to the inner one.
- JSX: `<Foo>`, `<Foo.Bar>` and `<$x>` are references with `context: 'jsx'`. `<div>`, `<my-element>` and `<this.Foo>` are not. Closing tags are not counted twice.
- A shorthand property is one reference (`context: 'shorthand'`), and `visit` visits it once.

## Stub

None. `compiler-core` is the first implementation. `nodes/compiler-infra-spike/proto/` is a working start: `scope.ts` for `analysis/scope.ts`, `source.ts` for `source.ts`, `errors.ts`, `walk.ts` and `imports.ts`, `model.ts` for the rest of `analysis/`, and `codegen.ts` for `codegen/`. It types nodes as `any`; the package uses `@oxc-project/types`.

## Contract tests

- `packages/silmaril/test/compiler/analysis/` (compiler-core): port `proto/test.ts` (Babel differential, recorded references, read and write flags, reference contexts, parameter scopes, namespaces, visit order, errors with locations, generated names, UTF-16 offsets, no `node:` imports), and the model half of `proto/fixtures.test.ts`: for every fixture with an `output.js`, the slots, entries (kind, id, output slot) and graphs of the model equal the ones `output.js` encodes, and every `compileError` fixture throws its message.
- `packages/silmaril/test/compiler/codegen/` (codegen-core, codegen-extras): the rest of `proto/fixtures.test.ts`: compile each `input.js`, run it with the runtime contract's runner protocol and compare logs. Compare text with `output.js` too where the fixture's layout is the compiler's (see the outcome for the three that differ), and one source map test per construct.

## Dependencies

- `oxc-parser`, exact (0.155.0 tested). Dependency of `silmaril`, used by the compiler entry only.
- `magic-string` `^1.4.4`. ESM only, which fits.
- `@oxc-parser/binding-wasm32-wasip1`: optional peer dependency at the exact `oxc-parser` version. Browser pages (`website-skeleton`, `runnable-samples`) install it, plus the `@napi-rs/wasm-runtime` 1.2.5 override.

## Changes

- v1: draft.
- v2, revised for `reactivity-runtime` v4 (bc5407d): setup declarations in nested blocks, function memos, written bindings are not local functions, `$`/`$sync` in expressions, the v4 error table and messages (the memo write and class field errors are gone), the class field arrow wrap, `.js` parsed as JSX. The earlier text was written against v3.
- v2 (proposed by compiler-infra-spike): sync `compile` plus a no-op `ready()`, own `SourceMap` with `file` naming the generated file, exact pinning with the wasm binding as an optional peer, one tsdown config with a `node:` import test. Internal API rewritten against `reactivity-runtime` v3: the `ReactiveScope` tree, slots, entries, reads (local functions, child memos), graphs, scope bindings, write sites, `$skip` calls, the compile errors and the import rewrite. Edit rules for magic-string and `Reference.context`. File layout matching the owned paths of compiler-core and the codegen nodes.
