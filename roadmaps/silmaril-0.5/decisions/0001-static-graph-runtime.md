# 0001: Static-graph runtime for silmaril 0.5

- Status: proposed. The user accepts or changes it at the `reactivity-adr` gate.
- Node: `reactivity-adr`. Contract: `contracts/reactivity-runtime.md` (proposed text in `nodes/reactivity-adr/proposed-reactivity-runtime.md`).
- Fixtures: `packages/silmaril/test/runtime/fixtures/`. A reference sketch that passes them is in `nodes/reactivity-adr/sketch/`.

## Context

The 0.4 runtime (`packages/silmaril/src/index.ts`) has these limits:

- Every write calls `$$update`, which runs every `$sync` and every computed of the instance and compares their dependency arrays.
- Computeds are `$sync` entries in declaration order. A computed can read a stale value of another computed.
- When a `$` or `$sync` reads a variable anywhere in its body, including inside nested `$` calls, a change rebuilds its whole child instance.
- `$` is scheduled with `setTimeout`, cleared and set again on each write.
- Reads inside local helper functions are not tracked.

The agreed direction is a static graph that the compiler emits, in the style of brumate, with zero runtime dependencies. Resumability and serialization are out of scope.

## Summary

- Each `$$`, `$composable`, and each run of a `$`, `$sync` or memo has a scope. Reactive variables live in numbered slots of their scope.
- The compiler emits one graph per setup body, as a module-level constant: for each slot, the entries that read it.
- A write stores the value and, when it changed by `Object.is`, queues the entries in the slot's list. Memos and `$sync` bodies run before the write returns. `$` bodies run in one microtask for all writes before it.
- Nothing is tracked at run time. The runtime only follows the lists.

## Decisions

### 1. Import specifier

Compiled code imports every helper from `'silmaril'`, as 0.4 does. The compiler removes the compile-time names (`$$`, `$`, `$sync`, `$skip`, `$store`, `$composable`, `onMount`, `onDestroy`) from the user's import and adds the helpers it uses. Other specifiers of that import, such as the `Store` type, stay.

- While the new runtime lives in `src/v2/`, the fixture runner and the behavior-suite `Pipeline.runtime` map `'silmaril'` to the namespace of `src/v2/index.ts`. `switch-to-v2` makes the `.` entry export it.
- Rejected: a separate specifier such as `'silmaril/runtime'`. It adds an entry to `package.json` and `tsdown.config.ts` (shared files), and users would see two entries for one runtime.
- Rejected: `'silmaril/v2'` during the transition. Every fixture and codegen test would change at the switch.

### 2. Helpers

`$$root`, `$$composable`, `$$get`, `$$set`, `$$update`, `$$memo`, `$$sync`, `$$effect`, `$$store`, `$$mount` and `$$destroy`. The exact signatures are in the contract. The user-facing names stay exported, with their types, and throw `'<name> is meant to be compile-time only.'` when called, as `$`, `$sync`, `$skip` and `$store` do in 0.4. `$$` and `$composable` are no longer runtime functions.

- Rejected: the draft's `$$scope(parent, graph, size)`. Compiled code never makes a scope by itself: `$$root`, `$$composable` and the entry helpers make them. The slot count is the graph's length, so `size` is not needed.

### 3. Values live in slots

A reactive variable is a slot of its scope. A read compiles to `$$get(scope, slot)` and a write to `$$set(scope, slot, value)`. Code inside nested functions reads the scope variable through the closure, so it needs no parent chain.

- Rejected: keeping values in JS locals and passing the old and new values to a notify helper. `x++` and destructuring cannot give the runtime the new value without temporaries, and the runtime cannot compare by `Object.is` without both.
- Rejected: emitting `scope.v[slot]` reads inline. It ties compiled code to the scope's shape. After minification `a(s,0)` and `s.v[0]` have the same size, and engines inline the small function.

### 4. Which declarations get a slot

Only declarations at the top level of a setup body are reactive, as in 0.4. Of those, one gets a slot when:

- it is a `let` that is written anywhere after its declaration, including inside nested functions,
- its initializer reads a slot (a memo), for `let` and `const`, or
- it is bound with `$store`.

Everything else stays a plain JS local: a `const` or `let` that is never written and reads no slot, function declarations, and declarations whose initializer is a function or arrow expression. Declarations inside nested blocks (`if`, loops) stay plain, because they can run many times or not at all.

- Rejected: a slot for every top-level declaration, as 0.4 makes every one reactive. It costs a slot and a write for values that never change.
- Rejected: treating `const f = () => count` as a memo, as 0.4 does. The function never changes. Its reads count where it is called (decision 13).

### 5. Graph format

One graph per setup body, emitted as a module-level `const` and shared by every instance:

```ts
type Ref = number | readonly number[];
type Graph = readonly (readonly Ref[] | undefined)[];
```

- `graph[slot]` lists the entries that read the slot. A number is an entry id in the same scope.
- An array `[e1, ..., eN, id]` is a path to an entry of a nested scope: the child scope of entry `e1`'s last run, then the child scope of `e2` in it, and so on, then entry `id` there. Inner entries that read an outer slot use it.
- The graph can be shorter than the slot count. A missing list means no entry reads the slot.
- Rejected: brumate's kind-keyed table (`g[kind][slot]`) with entry names. silmaril keeps entry bodies as closures inside the setup, so they need no export names, and a nested scope has at most one live instance per entry, so a path finds it without a kind lookup.
- Rejected: a runtime subscription list per slot, filled when a scope is made. It is a runtime graph again, and it needs cleanup on dispose.

### 6. Entry ids and the order a write runs them

Each scope numbers its entries from 0: memos first in declaration order, then `$sync` bodies and store write-backs in declaration order, then `$` bodies in declaration order. Registration still happens in source order.

A write to a slot that changed:

1. Queues each listed entry that is registered, alive and not already queued. The entry that is running is not queued by its own writes.
2. Runs queued memos until none are left, then returns if it was called from inside a memo.
3. If no `$sync` is running, runs queued `$sync` bodies one at a time until none are left, and runs the memos each one queues right after it.
4. Queues `$` bodies for the microtask (decision 7).

Each queue picks the entry with the lowest scope depth first, then the lowest id in that scope. Declaration order is a topological order for memos, because a memo can only read slots declared before it. So memos run in topological order, each once per write, and a parent's memos run before a child's.

- A memo is fresh when the write returns, even when the write happens inside a `$sync` or `$` body: step 2 runs even when step 3 is skipped.
- Rejected: one queue for memos and `$sync` in id order. A `$sync` that writes and then reads a memo would read a stale value.
- Rejected: FIFO order for `$sync`, as brumate orders bindings. The id order follows the source, so the user can predict it without knowing which write queued what.

### 7. `$` runs in a microtask, and writes batch

The first run of a `$` and every later run are queued. One `queueMicrotask` runs all queued `$` bodies, in depth then id order. A `$` queued while this flush runs, by a write inside a `$`, runs in the same flush.

- Several writes in one synchronous run queue a `$` once. It runs once with the final values.
- A queued `$` runs even when later writes put the old values back. 0.4 compared dependency arrays and skipped it.
- Memos and `$sync` do not batch. They run on each write, as in 0.4 (`count = 100; // Logs "Sync Count: 100"`).
- Rejected: `setTimeout`, as in 0.4. It waits for the next task and lets the page render stale values first.
- Rejected: an explicit `batch()` for `$sync`. It is new API with no request for it, and destructuring is the only compiled case that writes several slots at once (decision 9).
- Rejected: skipping a queued `$` whose read values all returned to their previous values. It needs a copy of every read value per entry, which a static graph avoids.

### 8. `$sync` stays a synchronous effect

`$sync` keeps its 0.4 meaning: a body with side effects that runs during setup and again before each write that changes what it reads returns. It runs after the memos of that write, so it sees settled values. It can own a child scope.

- Rejected: folding `$sync` into memos. Memos run in topological order and have no side effects. A `$sync` among them would run before later memos settle, and the user would read half-updated values. It would also need an output slot it does not have.

### 9. A write of the same value runs nothing

`$$set` compares with `Object.is` and stores nothing and queues nothing when equal. `NaN` equals `NaN`, and `0` differs from `-0`. A memo that computes the same value stops there. Mutating an object in place (`obj.a = 1`) is not a write, as in 0.4.

Each target of a destructuring assignment is its own write, so a `$sync` that reads two targets of `[a, b] = [b, a]` runs once per changed target (fixture `update-expression`).

### 10. Child scopes, re-runs and disposal

Every run of a memo, `$sync` or `$` gets a new child scope, passed to the body. The child scope has the slots of declarations in the body (graph passed as the last argument of `$$sync` or `$$effect`), and owns its lifecycles, entries, stores and composables.

- Before an entry runs again, the child scope of its last run is disposed.
- An entry's own reads are the reads in its argument, minus those inside nested `$`, `$sync` and memo entries and `$skip`. An inner entry that reads an outer slot is listed in the outer graph through a path, so the outer body does not run again (fixture `nested-scope`).
- Disposal sets the scope dead, disposes child scopes of entries in id order, then composable scopes in call order, then runs `onDestroy` callbacks and store unsubscribes in registration order. A queued entry of a dead scope does not run. A second dispose does nothing. A write to a dead scope stores the value and runs nothing.
- Rejected: the 0.4 rule, where a read anywhere in the body, nested `$` included, rebuilds the body. It is one of the listed limits. This changes the README's nested example: its `onDestroy` no longer runs when `y` changes, because only the inner `$` reads `y`.
- Rejected: creating the child scope only when the body needs one. The compiler cannot tell whether a called function is a composable. runtime-v2 can still allocate the scope's arrays lazily.

### 11. `onMount` and `onDestroy`

`onMount(fn)` compiles to `$$mount(scope, fn)` and `onDestroy(fn)` to `$$destroy(scope, fn)`, with the scope of the setup body that contains the call.

- A scope mounts after its setup returns, once its parent is mounted. Mounting mounts unmounted children first (entry children in id order, then composables), then runs its own callbacks in order. So a child made during the parent's setup mounts with the parent, and a child made later mounts right after its body.
- `$$mount` on a mounted scope runs the callback at once. `$$destroy` on a dead scope runs it at once. `$$mount` on a dead scope does nothing.
- Since the scope is a compiled argument, a lifecycle call after an `await` in an async body still attaches to the right scope.
- Rejected: returning a cleanup from `onMount` or from `$` bodies. It is new API, and `onDestroy` covers it.

### 12. `$store`

`const x = $store(store)` compiles to `$$store(scope, slot, store)`. `let x = $store(store)` compiles to `$$store(scope, slot, store, id)`, where `id` is a `$sync` entry for the write-back.

- `$$store` stores `store.get()` in the slot and subscribes. The listener writes `store.get()` to the slot with `$$set`. The unsubscribe runs on dispose.
- The write-back entry has no first run. When a slot write queues it, it calls `store.set(value)` only if `store.get()` differs by `Object.is`, so a value that came from the store is not written back.
- The store expression is evaluated once, at setup, and is not tracked.
- Writing a `let` bound to a store without `set` throws a `TypeError` from the write-back.
- A value that reaches another scope through a store is a new write. Entries that read values from both sides can run once per write (fixture `composable` logs `Value` and `Squared` separately for this reason).
- Rejected: write-back inside `$$set` through a per-slot hook. It adds a check to every write. The entry costs nothing for slots without a store.

### 13. Local functions

A call by name to a function declared inside the same root setup tree (function declarations, and `const` or `let` initialized with a function or arrow expression and never written) adds the function's reads to the calling entry. The compiler follows calls inside that function too, to a fixed point, so recursion is fine. Optional calls (`f?.()`) count.

- A function used as a value (passed, stored, returned) adds nothing (fixture `local-function`).
- Reads in inline function expressions inside an entry count for the entry, as in 0.4. `$skip` opts out.
- Rejected: adding reads for any reference to a local function. brumate also counts calls only. A handler passed to `addEventListener` inside a `$` would make the `$` run again on every change the handler reads.
- Rejected: ignoring reads in inline functions inside an entry. `items.map((item) => item * factor)` would miss `factor`.

### 14. What is not tracked

- Reads inside `$skip(expression)`, including reads through local functions called in it. `$skip(e)` compiles to `e`, with reads still compiled to `$$get` (fixture `skip`). `$skip` is new in practice: the 0.4 compiler only honored `/* $skip */` comments.
- Reads inside functions declared outside the root setup tree, including imported functions. They cannot name a slot, so this only affects closures passed to them and called later.
- Reads of outer slots inside a nested `$$`. A nested `$$` is a separate root, as in 0.4, and is not disposed with the outer one (fixture `nested-root`).
- The store expression of `$store`.

### 15. `$composable`

`$composable(fn)` compiles to `$$composable(graph, (scope, ...params) => body)`. The returned function has the original parameters and returns what the setup returns.

- A call makes a child scope of the scope that is running (the setup or entry run on the call stack). It is disposed with that scope and mounts with it.
- A call outside any running scope throws an `Error`. So does a call after an `await` in an async body.
- Parameters are plain values, not slots. Reactivity crosses into a composable through stores, as in 0.4.
- Rejected: running the composable in the caller's scope, as 0.4 does. Its slots and entry ids would collide with the caller's, which the static numbering cannot allow.

### 16. Errors

An error thrown by an entry does not stop the other entries of the same write. The first error is thrown again from the outermost `$$set` once its memos and `$sync` bodies have run. In the `$` flush, the first error is thrown from the microtask after all queued bodies ran, so the host reports it (fixture `error`).

- Rejected: stopping at the first error. It leaves memos stale until their inputs change again.

### 17. Compile-time limits

- `$` and `$sync` must be called in a setup body, outside loops. A call in a loop or inside a nested function is a compile error. A call inside `if` is fine: an entry that never registered is skipped.
- A read of a slot before its declaration returns `undefined` instead of throwing as the TDZ would. The compiler can report reads that come before the declaration in the setup body.
- A write cycle between `$sync` bodies does not end. The runtime does not detect it.

### 18. Size target

Measured with rolldown `minify: true` and gzip level 9, every export kept:

| Build                                   | Minified | Gzip   |
| --------------------------------------- | -------- | ------ |
| 0.4 `dist/index.mjs`                    | 2064 B   | 770 B  |
| Sketch (`nodes/reactivity-adr/sketch/`) | 2627 B   | 1278 B |

Target for `src/v2/index.ts`: at most 1.5 kB gzip with every export, and 1.2 kB as the aim. The sketch has 15 named fields in each scope and a separate error per stub. The real runtime can share them. An app that does not use `$store` or `$composable` loses those helpers to tree-shaking.

## Breaking changes from 0.4

These go in the 0.5.0 changeset:

- A `$` or `$sync` body runs again only for reads outside its nested entries. Nested `$` and `$sync` track outer variables on their own.
- `$` runs in a microtask instead of a `setTimeout`.
- A queued `$` runs even if the values it read returned to their old values before the flush.
- Only top-level declarations that are written, read a reactive value, or bind a store are reactive. Others are plain values. Block-level declarations in a setup are never reactive.
- `const f = () => ...` is never a computed. Calls to local functions add what they read.
- `$composable` gets its own scope instead of sharing the caller's. Calling it outside a reactive scope throws.
- `$skip(expression)` works.
- `$` and `$sync` in loops are compile errors.
- `$$` and `$composable` throw when called without the compiler.

## Questions for the gate

- Accept the nested re-run change (decision 10)? It is the fix the brief asks for, and it breaks the README's nested example.
- Accept that a queued `$` runs after a write and a write back to the old value (decision 7)?
- Accept the size target of 1.5 kB gzip, against 0.77 kB for 0.4?
- Export a public `tick(): Promise<void>` that resolves after queued `$` bodies ran? This record leaves it out. Tests can wait with `setTimeout(0)`.
