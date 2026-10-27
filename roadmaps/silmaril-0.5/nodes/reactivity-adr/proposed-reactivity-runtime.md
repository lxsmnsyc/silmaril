---
name: reactivity-runtime
version: 4
status: draft # the orchestrator sets frozen after the user approves
defined_by: reactivity-adr
---

# Contract: reactivity-runtime

## Purpose

The interface between the code `silmaril/compiler` emits and the runtime in `silmaril` (`src/`). `runtime-v2` implements it, `codegen-core` and `codegen-extras` emit code against it, and `docs-content` explains it. The two sides do not need to talk to each other: this file and the fixtures are the whole agreement. The reasons for each rule are in `decisions/0001-static-graph-runtime.md`.

Words used below:

- **Setup tree**: the function passed to a `$$` or `$composable`, with everything nested in it, except nested `$$` and `$composable` functions. Each of those starts its own setup tree.
- **Scope body**: a function that receives a scope. These are the setup function of a `$$` or `$composable`, and a function passed to `$` or `$sync` (an entry body).
- **Setup declaration**: a `let`, `const` or `var` statement in a scope body, directly or in a nested block, but not inside a nested function or a loop. A loop is a `for`, `for-in`, `for-of`, `while` or `do` statement, including its head.
- **Slot**: a numbered cell of a scope that holds one reactive variable.
- **Entry**: a memo, a store write-back, a `$sync` or a `$`. Each has an id in its scope.

## Interface

### Exports

Compiled code imports from `'silmaril'`. While the runtime lives in `src/v2/`, tests map `'silmaril'` to the namespace of `src/v2/index.ts`. `src/v2/index.ts` exports exactly these values:

| Export                                                                                                                    | Kind                                        |
| ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `$$root`, `$$composable`, `$$get`, `$$set`, `$$update`, `$$memo`, `$$sync`, `$$effect`, `$$store`, `$$mount`, `$$destroy` | helpers for compiled code                   |
| `tick`                                                                                                                    | public runtime function                     |
| `$$`, `$composable`                                                                                                       | compile-time names that also run, as in 0.4 |
| `$`, `$sync`, `$skip`, `$store`, `onMount`, `onDestroy`                                                                   | compile-time names; each throws when called |

and the types `Scope`, `Ref`, `Graph` and `Store`.

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
  body: (child: Scope) => unknown,
  graph?: Graph, // graph of the slots declared in the body
): void;
export function $$effect(
  scope: Scope,
  id: number,
  body: (child: Scope) => unknown,
  graph?: Graph,
): void;

// Stores. `id` is given for `let` and `var`: the entry id of the write-back.
export function $$store<T>(
  scope: Scope,
  slot: number,
  store: Store<T>,
  id?: number,
): void;

// Lifecycles
export function $$mount(scope: Scope, callback: () => void): void;
export function $$destroy(scope: Scope, callback: () => void): void;

// Public. Resolves after the queued $ bodies have run.
export function tick(): Promise<void>;

// Compile-time names that also run without the compiler, as in 0.4, for
// namespace calls and modules the compiler does not transform. $$ runs the
// setup at once in a root scope with an empty graph and returns its disposer.
// $composable returns setup.
export function $$(setup: () => void): () => void;
export function $composable<T extends (...args: any[]) => any>(setup: T): T;

// Compile-time names. Each throws Error('<name> is meant to be compile-time only.').
export function $<T>(value: T): void;
export function $sync<T>(value: T): void;
export function $skip<T>(value: T): T;
export function $store<T>(store: Store<T>): T;
export function onMount(callback: () => void): void;
export function onDestroy(callback: () => void): void;
```

### Graph format

- One graph per scope body. A `$$` or `$composable` setup always has one, `[]` when empty. An entry body has one when it declares slots. Otherwise the `graph` argument of `$$sync` or `$$effect` is left out.
- `graph[k]` lists every entry that reads slot `k` of that scope: a number for an entry of the same scope, a path for an entry of a nested entry body in the same setup tree. A path never goes through a composable scope or a nested root.
- A missing list, `undefined` and `[]` all mean that no entry reads the slot. The compiler writes `[]` for an empty list before the last non-empty one, and leaves out trailing empty lists, so a graph with no edges is `[]`. The runtime treats a missing list as empty.
- The compiler writes each list in canonical order: numbers ascending, then paths in lexicographic order of their numbers. The runtime must not depend on that order (fixtures `sibling-order-a` and `sibling-order-b`).
- Each graph is a module-level `const` declared after the last `import` declaration of the module, or at the start of the module when it has none. It is never placed before the statement that holds the setup: a function declaration that is called earlier in the module would read it in its temporal dead zone.

## Compiler rules

### Slots

A setup declaration is split into one statement per declarator, in order. A declarator gets slots, one per bound name in source order, when any of these holds:

1. It is a `let` or `var`, and one of its names is written anywhere in the module other than by its own initializer. A write in a nested function counts, and so does a write inside a nested `$$` or `$composable` (fixture `nested-root-write`).
2. Its initializer reads a slot (see "Reads" below). The declarator is then a **memo**, for `let`, `const` and `var`.
3. Its initializer is a call to `$store`.

Rule 2 is applied to a fixed point, because a memo makes the names that read it reads of a slot.

- A declarator whose initializer is a function or arrow expression is a memo when the function reads a slot, as in 0.4 (fixture `function-memo`). Its value is a new function each time a read slot changes.
- A declarator whose initializer is a call to `$$` or `$composable` is never a memo. It gets a slot only by rule 1.
- If one name of a destructuring declarator gets a slot, all its names do.
- A `var` follows the same rules as `let`. A second `var` declaration of the same name with an initializer is a write. Without an initializer it compiles to nothing.
- A declaration in a nested block, such as an `if`, `try`, `switch` or plain block, is a setup declaration, as in 0.4 (fixtures `block-slot`, `var-slot`). A memo or store in such a block registers only when the block runs.
- Declarations inside nested functions or loops stay plain JS locals, even if they are written. One slot cannot hold a binding per loop iteration.
- Slots of a scope are numbered from 0 in source order of the declarators.

### Entry ids

The entries of a scope are numbered from 0, in three groups:

1. memos and store write-backs (`let x = $store(s)` and `var x = $store(s)`), in source order;
2. `$sync` calls, in source order;
3. `$` calls, in source order.

Registration happens in source order, so ids are not registration order (fixture `order`).

### Reads

A read is an identifier reference that resolves to a binding with a slot, and that is not a write target. The reads of an entry are:

- for a memo, the reads in its initializer;
- for a store write-back, its own slot;
- for a `$sync` or `$` with an expression argument, the reads in the argument;
- for an entry body, the reads in the body.

From that set:

- Reads inside nested functions count, also when they are never called (decision 13).
- Reads inside nested entries do not count: nested `$` and `$sync` calls, and the initializers of memos declared in the entry body.
- Reads inside `$skip(...)` do not count, nor the reads of local functions called inside it.
- Reads inside a nested `$$` or `$composable` setup do not count, for any entry outside it.
- A call by name, `f(...)` or `f?.(...)`, to a **local function** adds the reads of that function. A local function is a function declaration in the same setup tree, or a declarator in the same setup tree whose initializer is a function or arrow expression. A binding that is written anywhere, or that has a slot, is never a local function: a call to it adds only the read of its slot, if it has one (fixture `written-function`). The reads of a local function are computed the same way, to a fixed point, so recursion ends. A local function used as a value adds nothing.
- Reads of the entry's own child slots are removed, with one exception: when the entry reads a memo of its own child scope, it gets the reads of that memo instead, to a fixed point (fixture `body-memo`). Reads of the child's `let`, `var` and `$store` slots stay removed: running the body again would reset them.

The same definition decides rule 2 of "Slots": the reads of a declarator are the reads of its initializer, computed as for a memo.

The graph of a scope lists, for each slot, every entry of the same setup tree whose reads include that slot.

### Names

- The compiler picks the names of scope parameters, temps, graph constants and helper imports. A generated name must differ from every identifier written in the module, and must not shadow a generated name that is used inside it.
- The fixtures use `$s` for a setup scope, `$s1`, `$s2` for further setup scopes nested in it, `$c<n>` for the child scope of entry `n` (`$c0_1` for entry 1 inside the child of entry 0), `$t<n>` for temps and `$g<n>` for graphs. These names are an example, not a requirement.
- A scope parameter that the body does not use can be left out: `() => expr` instead of `($c0) => expr`.

### Temps

- A destructuring write needs temps. They are declared in one `let $t0, $t1, ...;` statement at the start of the nearest enclosing function body, after its directives. Each write site has its own temps.
- When that function is an arrow with an expression body, the compiler gives it a block body: `(a) => expr` becomes `(a) => { let $t0, ...; return expr; }`.
- A destructuring write to a slot directly inside a class field initializer is wrapped in an arrow that is called at once and declares the temps: `field = (() => { let $t0, ...; return (form); })()`. An arrow keeps `this` and `super` of the initializer (fixture `class-field-destructure`).
- Declaring the temps in the nearest function makes them safe when that function runs again while a write is in progress, for example through a default value that calls it.

### Compiled forms

`$s` is the scope of the enclosing scope body that declares the slot, `$c<n>` the child scope of entry `n`, `$g<n>` a graph. `k`, `j` are slot numbers and `n` an entry id. `v` is the compiled right side.

| Source                                                 | Compiled                                                                                                                  |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `$$(() => { body })`                                   | `$$root($g0, ($s) => { body })`                                                                                           |
| `$$(() => expr)`                                       | `$$root($g0, ($s) => expr)`                                                                                               |
| `$composable((a, b) => { body })`                      | `$$composable($g1, ($s, a, b) => { body })`                                                                               |
| `let x = v` (slot k, not a memo)                       | `$$set($s, k, v)`                                                                                                         |
| `let x;` (slot k)                                      | nothing                                                                                                                   |
| read of `x`                                            | `$$get($s, k)`                                                                                                            |
| `{ x }` (shorthand property)                           | `{ x: $$get($s, k) }`                                                                                                     |
| `x = v`                                                | `$$set($s, k, v)`                                                                                                         |
| `x = y = v` (slots k, j)                               | `$$set($s, k, $$set($s, j, v))`                                                                                           |
| `x op= v`, op one of `+ - * / % ** << >> >>> & \| ^`   | `$$set($s, k, $$get($s, k) op (v))`                                                                                       |
| `x \|\|= v`, `x &&= v`, `x ??= v`                      | `($$get($s, k) \|\| $$set($s, k, v))`, same with `&&` and `??`                                                            |
| `x++`, `x--`, `++x`, `--x`                             | `$$update($s, k, 1, false)`, `$$update($s, k, -1, false)`, `$$update($s, k, 1, true)`, `$$update($s, k, -1, true)`        |
| destructuring assignment `P = e`                       | `(P' = $t0 = e, $$set($s, k1, $t1), ..., $$set($s, kN, $tN), $t0)`                                                        |
| same, as an expression statement                       | `P' = e;` then `$$set($s, k1, $t1); ... $$set($s, kN, $tN);` (wrap `P' = e` in parentheses when `P` is an object pattern) |
| `for (x of e) body` (also `for await`, `for (x in e)`) | `for (const $t0 of e) { $$set($s, k, $t0); body }`                                                                        |
| `for (P of e) body`                                    | `for (P' of e) { $$set($s, k1, $t1); ...; $$set($s, kN, $tN); body }`                                                     |
| `const y = e` (memo n, slot k)                         | `$$memo($s, n, k, () => e)`                                                                                               |
| `const { p, q } = e` (memo n, slots k, j)              | `$$memo($s, n, -1, () => { const { p, q } = e; $$set($s, k, p); $$set($s, j, q); })`                                      |
| `let [a, b] = e` (slots k, j, not a memo)              | statement form of the destructuring assignment `[a, b] = e`                                                               |
| `$sync(expr)` (entry n)                                | `$$sync($s, n, () => expr)`                                                                                               |
| `$sync(() => { body })`, `$sync(() => expr)`           | `$$sync($s, n, ($cn) => { body }, $g2)`, `$$sync($s, n, ($cn) => expr)`; `$g2` left out when the body has no slots        |
| `$(...)`                                               | `$$effect(...)`, same arguments as `$$sync`                                                                               |
| `const x = $store(s)` (slot k)                         | `$$store($s, k, s)`                                                                                                       |
| `let x = $store(s)` (slot k, write-back entry n)       | `$$store($s, k, s, n)`                                                                                                    |
| `onMount(fn)`, `onDestroy(fn)`                         | `$$mount(sc, fn)`, `$$destroy(sc, fn)`                                                                                    |
| `$skip(e)`                                             | `(e)`; reads in `e` still compile to `$$get`, writes to `$$set`                                                           |

Notes on the table:

- `() => e` in the memo, `$sync` and `$` forms: when `e` is an object literal or a sequence expression, it is written `() => (e)` (fixture `object-memo`).
- `(v)`: the parentheses can be left out when `v` is an identifier, a literal, a call, a member access or another expression that binds at least as tightly as `op`. They are never wrong.
- The outer parentheses of the logical form can be left out only where the form is a whole argument, a whole statement or a whole initializer.
- `P'` is the pattern `P` as written, with each slot target replaced by its own temp `$t1`...`$tN`, numbered in source order. Shorthand properties become `key: $tI`. Defaults, computed keys, holes, nesting, rest elements and member targets stay as written. Reads inside defaults and computed keys compile as usual, except that a read of a slot that is a target earlier in the same pattern reads its temp. After the pattern, the slots are written in source order of the targets (fixture `destructure-assign`).
- A function passed to `$` or `$sync` is the entry body, whatever its body kind: block, expression, `async` or `function`. Any other argument is an expression entry and is wrapped as `() => expr`. The body's return value, including a promise, is ignored.
- `sc` for `onMount` and `onDestroy` is the scope of the nearest enclosing scope body. Inside a memo initializer or an expression entry, it is the run's child scope: the compute or wrapper takes `($cn)`.
- A write inside `$skip(...)` is still a write.
- Assignments and updates of plain locals, and member writes such as `obj.a = 1`, are not changed.

### Imports

- The compiler removes the compile-time names (`$$`, `$`, `$sync`, `$skip`, `$store`, `$composable`, `onMount`, `onDestroy`) from every named `import` from `'silmaril'`, matching each local binding, so an alias such as `import { $sync as sync }` works. It removes the declaration if no specifier is left. Other specifiers, such as `tick` and the `Store` type, stay.
- It adds the helpers it uses, aliased when a name is taken. It can merge them into the user's first named import from `'silmaril'`, which is preferred because the 0.4 Babel plugin's output does that, or add one `import { ...helpers } from 'silmaril';` declaration before the first statement of the module. Both are valid.
- A namespace or default import of `'silmaril'` is left as is, and calls through it are not compiled. `$$` and `$composable` called that way run without reactivity, as in 0.4 (fixture `namespace-root`).

### Compile errors

The compiler throws an error whose message contains the text below. `<name>` is the imported name as written in the source, alias included.

| Case                                                                                                                               | Message                                                            |
| ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `$` or `$sync` inside a loop of a scope body (`for`, `for-in`, `for-of`, `while`, `do`)                                            | `<name> cannot be called inside a loop.`                           |
| `$` or `$sync` inside a nested function, a memo initializer or the argument of another `$` or `$sync`, or outside every setup tree | `<name> must be called directly in a setup body.`                  |
| `$` or `$sync` called with other than one argument (the 0.4 text)                                                                  | `<name> can only accept a single argument`                         |
| `$skip` or `$store` called with other than one argument                                                                            | `<name> takes exactly one argument.`                               |
| `$$` or `$composable` whose argument is not a function or arrow expression                                                         | `<name> must be called with a function.`                           |
| a compile-time name used other than as a call                                                                                      | `<name> can only be called.`                                       |
| `$store` that initializes a declarator with a pattern binding (the 0.4 text)                                                       | `$store is only limited to identifiers.`                           |
| `$store` that is not the whole initializer of a setup declaration                                                                  | `$store must initialize a variable of a setup body.`               |
| `$skip`, `onMount` or `onDestroy` outside every setup tree                                                                         | `<name> must be used inside $$ or $composable.`                    |
| a write to a `const` binding that has a slot                                                                                       | `Cannot assign to a constant.`                                     |
| a reactive variable used as a JSX tag name, such as `<Tag />` or `<Tag.Item />`                                                    | `A reactive variable cannot be used as a JSX tag.`                 |
| a comment whose text is `$skip` with only spaces around it, inside a setup tree                                                    | `The /* $skip */ comment is not supported. Use $skip(expression).` |

Fixtures: `loop-entry`, `entry-in-function`, `entry-arguments`, `root-argument`, `store-pattern`, `jsx-tag`, `skip-comment`.

A `$` or `$sync` may be called anywhere else in a scope body, as in 0.4: as a statement, inside `if`, `try`, `switch` or a labeled statement, or inside an expression such as `a && $(x)` (fixture `entry-in-expression`). The call evaluates to `undefined`. An entry that never registered does not run.

A write to a slot in a memo initializer is allowed, as in 0.4. It follows the runtime rule for writes in the memo phase (fixtures `memo-writes-slot`, `memo-write-runtime`).

## Behavior

### Scopes

- `$$root` makes a root scope at depth 0. A run of an entry makes an entry child scope, and a call of a composable makes a composable scope. Both have the depth of their parent plus 1.
- Each scope has a rank among its siblings. An entry child scope's rank is its entry id. Composable scopes come after every entry child scope of the parent, in call order. Roots rank among themselves by creation order.

### Order

Two queued entries of the same phase run in this order:

1. The entry whose scope has the lower depth runs first.
2. At equal depth, walk both scopes up to their closest common ancestor, and compare the ranks of the two branches under it. Two roots compare by creation order. In the same scope, the lower entry id runs first.

Declaration order is a topological order for memos, so memos run in topological order, and parents run before children.

When an entry is taken from a queue and any scope between it and its root belongs to a queued entry, the entry does not run and leaves the queue. That ancestor's run disposes its scope (fixtures `effect-parent-child`, `child-memo-wasted`, `body-memo`).

### Writes and phases

There are three phases: the memo phase (memos and write-backs), the `$sync` phase and the `$` flush.

- `$$set(scope, slot, value)` compares with `Object.is`. When equal, it stores nothing, runs nothing and returns `value`.
- Otherwise it stores the value. If the scope is dead, it returns `value`. Else it queues each entry listed for the slot. It skips an entry that is not registered, whose scope is missing or dead, or that is already queued. An entry that is running can be queued, as in 0.4: it runs again after it returns, so a body that writes what it reads runs until the value settles (fixtures `self-write`, `parent-child-cycle`). Then it drains, and returns `value`.
- Drain:
  1. If the memo phase is active, return. The active phase takes the new entries.
  2. Run queued memos and write-backs in order, until none is left.
  3. If a `$sync` body is running, return. Its queued `$sync` bodies run after the outermost running `$sync` body returns.
  4. Run queued `$sync` bodies in order, until none is left. Writes in each body run step 2 before they return.
  5. Reset the loop count, then throw the held error, if any.
- After `$$set` returns, every memo it reached holds its new value, unless the call was made while the memo phase was active. Writes inside `$sync` and `$` bodies get fresh memos.
- A write while the memo phase is active stores the value and queues its entries. They run in the same memo phase, after the running memo returns. So that memo can compute again in the same write (fixtures `memo-write-runtime`, `memo-writes-slot`).
- `$` bodies are never run by a write. A queued `$` waits for the flush.
- A queued `$` runs even if later writes put the old values back.

### Loop guard

- The outermost drain counts the entries it takes from the memo and `$sync` queues, through every nested drain, including entries it skips. When the count passes 10000, each entry taken after that throws `Error('Update loop')` in place of running. The first one is held like any other error, the others are dropped, so the rest of the drain runs nothing and its queues empty. The outermost drain throws the held error at step 5, so it reaches the caller of the write, or of the registration or `$$root` (fixture `update-loop`).
- The count resets when the outermost drain ends, whether it failed or not. The next write starts at 0, and an entry that was queued when the drain stopped is no longer queued.
- The `$` flush has its own count. It counts the `$` bodies it takes that ran before. A first run does not count, so a flush can start any number of new `$` bodies. When the count passes 10000, each `$` taken after that throws `Error('Update loop')` in place of running, and the flush holds the first error and throws it from the microtask after `tick()` promises resolve. The count starts at 0 in each flush. Writes inside a `$` body drain with the synchronous count, which resets when that write's drain ends.
- A cycle that settles is not an error: a write of the value a slot already holds queues nothing (fixture `two-way-binding`). A single write that runs more than 10000 entries in one drain also throws.

### Registration

- `$$memo` registers the memo and runs it at once in the memo phase, then drains.
- `$$sync` registers the body and runs it at once as a running `$sync` body, then drains. Inside another `$sync` body, the drain stops at step 3, so a body's effects come in the same order on its first run and on later runs (fixture `sync-first-vs-rerun`).
- `$$effect` registers the body and queues its first run.
- `$$store` reads `store.get()` into the slot. With `id`, it registers the write-back and runs it once in the memo phase, then drains, as 0.4 did. Then it subscribes.
- An entry that was never registered, for example in an `if` branch that did not run, is skipped by writes.

### Runs and child scopes

- A run disposes the child scope of the entry's last run, makes a new child scope with the graph given at registration, and calls the function with the child scope, which is the running scope for `$composable` during the call.
- After the call, the child scope mounts at once, as in 0.4, also when the entry's scope is not mounted yet (fixture `lifecycle`).
- A memo with `slot >= 0` writes the returned value with `$$set` after the call. With `slot === -1`, it writes its slots itself.
- `$$update` reads the slot, applies `++` or `--` (so BigInt works), writes with `$$set`, and returns the new value when `prefix` is true and the old numeric value otherwise.

### The `$` flush and `tick`

- Queuing a `$` when no flush is pending schedules one with `queueMicrotask`. `tick()` also schedules one when none is pending.
- The flush runs queued `$` bodies one at a time, in order, until none is left, including `$` bodies queued during the flush. No phase is active while a `$` body runs, so its writes drain in full and may throw into the body.
- When the queue is empty, the flush resolves every pending `tick()` promise, then throws the first error a `$` body threw, from the microtask, so the host reports it.
- `tick()` returns a promise that resolves at the end of the next flush. It resolves after every `$` queued before that flush ends, including the ones queued after the call. It never rejects (fixture `tick`).

### Lifecycles

- A root mounts after its setup returns. An entry child scope mounts right after its run. A composable scope mounts at the place of its call among the parent's `$$mount` callbacks: when the parent is mounted, right after the call; otherwise when the parent mounts, between the callbacks registered before and after the call (fixture `composable-lifecycle`). Mounting runs the scope's `$$mount` callbacks in registration order.
- `$$mount` on a mounted scope runs the callback at once. On a dead scope it does nothing.
- `$$destroy` on a dead scope runs the callback at once.
- A scope is disposed by the function `$$root` returns, by a new run of its entry, with its parent, or when its setup or run throws. Disposing marks it dead, then disposes entry child scopes in registration order of their entries (fixture `dispose-order`), then runs `$$destroy` callbacks and store unsubscribes in registration order, with each composable scope disposed at the place of its call among them. This is the 0.4 order, where a composable shared its caller's instance. A second dispose does nothing. A nested root is not a child: only its own function disposes it.
- A queued entry of a dead scope does not run. A write to a dead scope stores the value and runs nothing.
- An error thrown by a mount or destroy callback propagates to the caller of the mount or dispose. The remaining callbacks of that scope do not run.

### Stores

- The subscription listener calls `$$set(scope, slot, store.get())`. The unsubscribe is added to the scope's destroy list.
- The write-back runs in the memo phase, once at registration and again each time the slot changes, also when the change came from the store. It calls `store.set(value)` each time, as 0.4 did, so a store that does not compare values sees the value it sent (fixture `store-echo`). The store and its other bindings are fresh when the write returns (fixture `store-writeback-batch`). A store without `set` makes it throw a `TypeError` at registration, which the setup throws.
- The store expression is evaluated once and is not tracked.
- A value that reaches another scope through a store is a new write in that scope. The scopes run in the order above, so an entry that reads values from both sides can see a new value next to an old one, then run again (fixture `composable-glitch`).
- An entry body that reads a `$store` slot of its own child scope does not run again when the store changes. Entries nested in it do.

### Composables

- The function `$$composable` returns makes a composable scope under the running scope (the setup or entry run on the call stack). It calls `setup(child, ...args)` with the child running, adds the child to the parent's mount and destroy lists at the place of the call, mounts it at once if the parent is mounted, and returns the setup's result.
- Called while no scope is running, it throws `Error('Unexpected missing reactive boundary.')`, the 0.4 message. This includes a call after an `await` in an async body.

### Errors

- An error thrown by a run during a drain or a registration is held. The first held error wins and later ones are dropped. The other queued entries still run. The outermost drain, which is the one that started with no memo phase active and no `$sync` body running, throws it at step 5.
- When a run throws, its new child scope is disposed before the error is held. The entry stays registered and runs again when what it reads changes. A memo that throws keeps its old value (fixtures `error`, `error-in-rerun`, `memo-throws`).
- When a `$$root` setup throws, the root is disposed and the error is thrown again from `$$root` (fixture `setup-throws`).
- When a composable setup throws, its scope is disposed and never added to the parent, and the error is thrown again from the call.
- Errors thrown by setup code outside entries propagate as usual.

### Limits

- A read of a slot before its declaration returns the empty slot, `undefined`.
- A write cycle that does not settle throws `Update loop` (see "Loop guard").
- Each memo runs at most once per write when every memo reads only slots declared before it and no memo writes a slot.
- Mutating an object in place is not a write.

### Size

- `src/v2/index.ts` is at most 1.5 kB after rolldown `minify: true` and gzip level 9, with every export. The aim is 1.2 kB. The sketch measures 1481 B. 0.4 measures 770 B.

## Stub

Hand-written compiled output for each construct is in `packages/silmaril/test/runtime/fixtures/<name>/`:

- `input.js`: the source a user writes.
- `output.js`: the compiled output, written by hand against this contract. A compile-error fixture has none.
- `expected.json`: `{ "description": string, "logs": unknown[][] }`, or `{ "description": string, "compileError": string }` when compiling `input.js` must fail.

Runner protocol, for `runtime-v2` and the codegen nodes:

1. Read the module text. Replace each `import { a, b as c } from 'silmaril';` with `const { a, b: c } = runtime;`, and each `import * as name from 'silmaril';` with `const name = runtime;`. No other imports appear.
2. Run the text as the body of an async function with the parameters `runtime` and `log`. `log(...args)` appends `args` to the log list. Fixtures wait for the `$` flush with the runtime's own `tick`.
3. After the body resolves, wait one macrotask (`setTimeout(resolve, 0)`), then compare the log list with `logs` using deep equality. If the body throws, the fixture fails.
4. For a `compileError` fixture, the runtime runner skips it. The codegen tests compile `input.js` and pass when the compiler throws an error whose message contains `compileError`.

`output.js` runs against the runtime. The codegen nodes compile `input.js` and run the result the same way. They compare logs, not text. Each fixture's comments give the slot and entry numbering the compiler is expected to produce. `nodes/reactivity-adr/sketch/` holds a reference runtime and runner that pass every fixture.

The fixtures are `.js`. tsc ignores them (no `allowJs` in `tsconfig.base.json`), vitest only collects `test/**/*.test.ts`, and they pass oxlint and oxfmt.

No fixture throws from a `$` body or from the `$` flush guard, because the error leaves a microtask. `runtime-v2` tests those cases in vitest with its own handler.

## Contract tests

`packages/silmaril/test/runtime/*.test.ts` (written by `runtime-v2`) runs every fixture's `output.js` against the runtime. The behavior suite (`behavior-suite` contract) runs compiled code end to end, and its `flush()` can use `tick` on the 0.5 pipeline.

## Changes

- v1: draft.
- v2: helpers, graph format, ordering, scheduling, lifecycles, stores, composables and errors decided by `reactivity-adr`. `$$scope` replaced by `$$root` and `$$composable`.
- v4: loop guard (`Update loop`, 10000 entry runs per drain and per `$` flush). Changes from 0.4 reverted where a 0.4 rule works as well: a running entry can be queued, block declarations outside loops get slots, function initializers that read a slot are memos, entries can be called inside expressions, memo initializers can write slots, a class field destructuring write is wrapped, child scopes mount right after their run, dispose follows registration order, composables mount and dispose at the place of their call, store write-backs run at registration and on every change, `$$` and `$composable` run without the compiler, and 0.4 error messages. Compiler change requests from PR #9: slot rule 1 counts writes anywhere in the module, write-backs read their own slot, written bindings are not local functions, trailing empty graph lists are left out, `for (P of e)` keeps the pattern in place, merged imports, parentheses for object and sequence bodies, and compile errors for a non-function `$$` or `$composable` and for a reactive JSX tag.
- v3: gate decisions and design reviews. `tick` added. Total order between sibling scopes. Children of a queued entry do not run. A running entry is never queued, at any depth. `$sync` registration runs as a running body. Store write-backs run in the memo phase. Errors dispose the scope of the failed run or setup. Memo writes are a compile error. Exact compiler rules: slots (including `var`), reads, names, temps, parenthesized compound forms, in-place destructuring, `for-of` and `for-in` targets, imports, graph placement and compile errors. The `/* $skip */` comment is a compile error.
