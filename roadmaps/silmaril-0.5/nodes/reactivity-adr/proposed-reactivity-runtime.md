---
name: reactivity-runtime
version: 2
status: draft # the orchestrator sets frozen after the user approves
defined_by: reactivity-adr
---

# Contract: reactivity-runtime

## Purpose

The interface between the code `silmaril/compiler` emits and the runtime in `silmaril` (`src/`). `runtime-v2` implements it, `codegen-core` and `codegen-extras` emit code against it, and `docs-content` explains it. The reasons for each rule are in `decisions/0001-static-graph-runtime.md`.

## Interface

Compiled code imports these from `'silmaril'`. While the runtime lives in `src/v2/`, tests map `'silmaril'` to the namespace of `src/v2/index.ts`.

```ts
// Opaque to compiled code. runtime-v2 decides the fields.
export interface Scope {}

// graph[slot] lists the entries that read the slot.
// A number is an entry id in the same scope.
// [e1, ..., eN, id] is entry `id` in the child scope of e1's last run,
// then of e2's last run in that scope, and so on.
export type Ref = number | readonly number[];
export type Graph = readonly (readonly Ref[] | undefined)[];

export interface Store<T> {
  get(): T;
  set?: (value: T) => void;
  subscribe(callback: () => void): () => void;
}

// Roots and composables
export function $$root(graph: Graph, setup: (scope: Scope) => void): () => void;
export function $$composable<A extends unknown[], R>(
  graph: Graph,
  setup: (scope: Scope, ...args: A) => R,
): (...args: A) => R;

// Slots
export function $$get(scope: Scope, slot: number): any;
export function $$set<T>(scope: Scope, slot: number, value: T): T;
export function $$update(
  scope: Scope,
  slot: number,
  delta: 1 | -1,
  prefix: boolean,
): any; // the value of x++, x--, ++x or --x

// Entries. `id` is the entry id in `scope`. `child` is the scope of this run.
export function $$memo(
  scope: Scope,
  id: number,
  slot: number, // -1: compute writes its slots itself
  compute: (child: Scope) => unknown,
): void;
export function $$sync(
  scope: Scope,
  id: number,
  body: (child: Scope) => void,
  graph?: Graph, // graph of the slots declared in the body
): void;
export function $$effect(
  scope: Scope,
  id: number,
  body: (child: Scope) => void,
  graph?: Graph,
): void;

// Stores. `id` is given for `let`: the entry id of the write-back.
export function $$store<T>(
  scope: Scope,
  slot: number,
  store: Store<T>,
  id?: number,
): void;

// Lifecycles
export function $$mount(scope: Scope, callback: () => void): void;
export function $$destroy(scope: Scope, callback: () => void): void;

// User-facing names. Each throws Error('<name> is meant to be compile-time only.').
export function $$(setup: () => void): () => void;
export function $<T>(value: T): void;
export function $sync<T>(value: T): void;
export function $skip<T>(value: T): T;
export function $store<T>(store: Store<T>): T;
export function $composable<T extends (...args: any[]) => any>(setup: T): T;
export function onMount(callback: () => void): void;
export function onDestroy(callback: () => void): void;
```

### Compiled forms

`$s` is the scope of the setup body, `$c<n>` the child scope of entry `n`'s run, `$g<n>` a module-level graph. Names are free. The shapes are fixed.

| Source                                   | Compiled                                                                                        |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `$$(() => { body })`                     | `$$root($g0, ($s) => { body })`                                                                 |
| `$composable((a, b) => { body })`        | `$$composable($g1, ($s, a, b) => { body })`                                                     |
| `let x = 0` (slot 0)                     | `$$set($s, 0, 0)`                                                                               |
| read of `x`                              | `$$get($s, 0)`                                                                                  |
| `x = v`, `x += v`                        | `$$set($s, 0, v)`, `$$set($s, 0, $$get($s, 0) + v)`                                             |
| `x++`, `--x`                             | `$$update($s, 0, 1, false)`, `$$update($s, 0, -1, true)`                                        |
| `x \|\|= v`                              | `$$get($s, 0) \|\| $$set($s, 0, v)` (same for `&&=`, `??=`)                                     |
| `[a, b] = e`                             | `(($t = e), $$set($s, 0, $t[0]), $$set($s, 1, $t[1]), $t)`                                      |
| `const y = x * 2` (slot 1, memo 0)       | `$$memo($s, 0, 1, () => $$get($s, 0) * 2)`                                                      |
| `const { p, q } = x` (slots 1, 2)        | `$$memo($s, 0, -1, () => { const { p, q } = $$get($s, 0); $$set($s, 1, p); $$set($s, 2, q); })` |
| `$sync(expr)` (entry n)                  | `$$sync($s, n, () => expr)`                                                                     |
| `$sync(() => { body })`                  | `$$sync($s, n, ($cn) => { body }, $g2)` (graph omitted when the body has no slots)              |
| `$(expr)`, `$(() => { body })`           | `$$effect(...)`, same arguments as `$$sync`                                                     |
| `const x = $store(s)`                    | `$$store($s, 0, s)`                                                                             |
| `let x = $store(s)` (write-back entry n) | `$$store($s, 0, s, n)`                                                                          |
| `onMount(fn)`, `onDestroy(fn)`           | `$$mount($s, fn)`, `$$destroy($s, fn)` with the scope of the enclosing body                     |
| `$skip(e)`                               | `e`, reads compiled, no edges                                                                   |

The compiler removes the user-facing names from the user's `import` from `'silmaril'` and adds the helpers it uses. The fixtures under `packages/silmaril/test/runtime/fixtures/` show each form in full.

## Behavior

### Slots and graphs

- Only top-level declarations of a setup body (`$$`, `$composable`, or a function-bodied `$`, `$sync`) can get a slot. One gets a slot when it is a `let` written after its declaration, when its initializer reads a slot (a memo, `let` or `const`), or when it binds `$store`. Other declarations, functions, function-valued initializers and block-level declarations stay plain locals.
- Slots of a scope are numbered from 0 in declaration order. A graph is a module-level constant, one per setup body, shared by all instances. It can be shorter than the slot count.
- Entry ids of a scope are numbered from 0: memos in declaration order, then `$sync` bodies and store write-backs in declaration order, then `$` bodies in declaration order. Registration happens in source order.
- An entry's reads are the slot reads in its argument, including inline nested functions, minus reads inside nested `$`, `$sync` and memo entries and inside `$skip(...)`. Reads of slots declared inside the entry's own body are not its reads.
- A call by name (`f()`, `f?.()`) to a function declared inside the same root setup tree adds the reads of that function and of the functions it calls, to a fixed point. A function used as a value adds nothing.
- An inner entry that reads an outer slot is listed in the outer scope's graph through a path. Reads inside a nested `$$` are not listed anywhere: a nested `$$` is a separate root.
- `$` and `$sync` must be called in a setup body, outside loops and nested functions. The compiler reports other calls as errors.

### Writes and order

- `$$set` compares with `Object.is`. When equal, it stores nothing, runs nothing, and returns `value`. Otherwise it stores the value and, if the scope is alive, queues the entries listed for the slot. It skips entries that are not registered, are in a dead scope, are already queued, or are the entry that is running.
- After queuing, `$$set` runs all queued memos, then returns if it was called from inside a memo. Otherwise, if no `$sync` is running, it runs queued `$sync` bodies one at a time, running the memos each one queues right after it. Then it returns `value`.
- Each queue takes the entry with the lowest scope depth first, then the lowest id within that scope. So memos run in topological order, each at most once per write unless a `$sync` writes their input again, and parents run before children.
- After `$$set` returns, every memo it reaches holds its new value, also when `$$set` is called inside an entry.
- `$` bodies are queued, never run inside `$$set`. One `queueMicrotask` flush runs all queued `$` bodies in the same depth-then-id order. A `$` queued during the flush runs in the same flush. Several writes before the flush run a `$` once.
- A queued `$` runs even if later writes put the old values back.
- `$$memo`, `$$sync` and `$$store` run at registration: the memo computes, the `$sync` body runs, the store is read and subscribed. `$$effect` queues the first run. A store write-back entry has no first run.

### Runs and child scopes

- Every run of a memo, `$sync` or `$` disposes the child scope of the entry's last run, makes a new child scope (with the graph given to `$$sync` or `$$effect`), and calls the function with it. During the call, the child scope is the running scope for `$composable`.
- A memo with `slot >= 0` writes the returned value to that slot with `$$set` after the run. With `slot === -1`, it returns nothing and writes its slots itself.
- `$$update` reads the slot, applies `++` or `--` (so BigInt works), writes with `$$set`, and returns the new value when `prefix` is true and the old numeric value otherwise.

### Lifecycles

- A scope mounts after its setup or run returns, and only once its parent is mounted. Mounting first mounts its unmounted child scopes (entry children in id order, then composable scopes in call order), then runs its `$$mount` callbacks in registration order.
- `$$mount` on a mounted scope runs the callback at once. On a dead scope it does nothing.
- `$$destroy` on a dead scope runs the callback at once.
- A scope is disposed by the function `$$root` returns, by a new run of its entry, or with its parent. Disposing marks it dead and disposes entry child scopes in id order, then composable scopes in call order. Then it runs `$$destroy` callbacks and store unsubscribes in registration order. A second dispose does nothing. A nested `$$root` is not a child: it is disposed only by its own function.
- A write to a dead scope stores the value and runs nothing.

### Stores

- `$$store` stores `store.get()` in the slot, subscribes with a listener that calls `$$set(scope, slot, store.get())`, and adds the unsubscribe to the scope's destroy list.
- With `id`, it registers a `$sync` entry with that id that calls `store.set(value)` when `store.get()` differs from the slot's value by `Object.is`. A store without `set` throws a `TypeError` there.
- The store expression is evaluated once and is not tracked.

### Composables

- The function `$$composable` returns makes a child scope of the running scope, which is the setup or entry run on the call stack. It calls `setup(child, ...args)` with the child running, mounts the child if the parent is mounted, and returns the setup's result.
- Called while no scope is running, it throws an `Error`.

### Errors

- An error in an entry does not stop the other queued entries. The outermost `$$set` throws the first error after its memos and `$sync` bodies ran. The `$` flush throws the first error after all queued bodies ran.
- Errors in a setup body propagate out of `$$root` or the composable call.

### Limits

- A read of a slot before its declaration returns `undefined`.
- Write cycles between `$sync` bodies or `$` bodies do not end. The runtime does not detect them.
- Mutating an object in place is not a write.

### Size

- `src/v2/index.ts` is at most 1.5 kB after rolldown minify and gzip level 9, with every export. The aim is 1.2 kB. The ADR's sketch measures 1278 B. 0.4 measures 770 B.

## Stub

Hand-written compiled output for each construct is in `packages/silmaril/test/runtime/fixtures/<name>/`:

- `input.js`: the source a user writes.
- `output.js`: the compiled output, written by hand against this contract.
- `expected.json`: `{ "description": string, "logs": unknown[][] }`.

Runner protocol, for `runtime-v2` and the codegen nodes:

1. Read the module text. Replace each `import { a, b as c } from 'silmaril';` with `const { a, b: c } = runtime;`. No other imports appear.
2. Run the text as the body of an async function with the parameters `runtime`, `log` and `tick`. `log(...args)` appends `args` to the log list. `tick()` returns `new Promise((resolve) => setTimeout(resolve, 0))`.
3. After the body resolves, `await tick()` once more, then compare the log list with `logs` using deep equality.

`output.js` runs against the runtime. The codegen nodes compile `input.js` and run the result the same way. They compare logs, not text. Each fixture's comments give the slot and entry numbering the compiler is expected to produce. `nodes/reactivity-adr/sketch/` holds a reference runtime and runner that pass every fixture.

The fixtures are `.js`. tsc ignores them (no `allowJs` in `tsconfig.base.json`), vitest only collects `test/**/*.test.ts`, and they pass oxlint and oxfmt.

## Contract tests

`packages/silmaril/test/runtime/*.test.ts` (written by `runtime-v2`) runs every fixture's `output.js` against the runtime. The behavior suite (`behavior-suite` contract) runs compiled code end to end.

## Changes

- v1: draft.
- v2: helpers, graph format, ordering, scheduling, lifecycles, stores, composables and errors decided by `reactivity-adr`. `$$scope` replaced by `$$root` and `$$composable`.
