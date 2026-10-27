# 0001: Static-graph runtime for silmaril 0.5

- Status: proposed, revised after the gate. The maintainer's gate decisions are applied, and so are the findings of the runtime design review of PR #8 and the "reactivity-runtime" section of the compiler design review of PR #9. The contract is ready to freeze.
- Node: `reactivity-adr`. Contract: `contracts/reactivity-runtime.md` (proposed text, version 3, in `nodes/reactivity-adr/proposed-reactivity-runtime.md`).
- Fixtures: `packages/silmaril/test/runtime/fixtures/` (45). A reference sketch that passes them is in `nodes/reactivity-adr/sketch/`.

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
- The compiler emits one graph per scope body, as a module-level constant after the imports: for each slot, the entries that read it.
- A write stores the value and, when it changed by `Object.is`, queues the entries in the slot's list. Memos run before the write returns. `$sync` bodies run before it returns too, unless a `$sync` body is running, in which case they run when the outermost one returns. `$` bodies run in one microtask flush, and `tick()` waits for it.
- Queued entries run in one total order: lower depth first, then by position under the closest common ancestor. An entry whose ancestor entry is queued does not run, and a running entry is never queued.
- Nothing is tracked at run time. The runtime only follows the lists.

## Gate decisions

The maintainer decided these at the gate (PR #8, comment "Maintainer decisions at the gate"):

1. Accepted: outer bodies no longer run again for reads inside nested `$` and `$sync` (decision 10). `switch-to-v2` rewrites the README nested example.
2. Accepted: a queued `$` still runs when a later write in the same task restores the old value (decision 7).
3. Size: 1.5 kB gzip is a hard cap. About 1.2 kB is the target (decision 18).
4. Added: a public `tick(): Promise<void>` that resolves after queued `$` bodies have run (decision 7, fixture `tick`).
5. Accepted for the 0.5.0 changeset: reactive declarations limited to those that are written, read a reactive value or bind a store; `$composable` gets its own scope; `$` and `$sync` in loops are compile errors; destructuring writes each target separately; a store passing a value between scopes counts as a new write.
6. Left open for this record: does a nested `$$` track outer variables? Answered in decision 20: no.

## Decisions

### 1. Import specifier

Compiled code imports every helper from `'silmaril'`, as 0.4 does. The compiler removes the compile-time names (`$$`, `$`, `$sync`, `$skip`, `$store`, `$composable`, `onMount`, `onDestroy`) from the user's named imports and adds one import with the helpers it uses. Other specifiers, such as `tick` and the `Store` type, stay.

- While the new runtime lives in `src/v2/`, the fixture runner and the behavior-suite `Pipeline.runtime` map `'silmaril'` to the namespace of `src/v2/index.ts`. `switch-to-v2` makes the `.` entry export it.
- Rejected: a separate specifier such as `'silmaril/runtime'`. It adds an entry to `package.json` and `tsdown.config.ts` (shared files), and users would see two entries for one runtime.
- Rejected: `'silmaril/v2'` during the transition. Every fixture and codegen test would change at the switch.

### 2. Exports

Helpers: `$$root`, `$$composable`, `$$get`, `$$set`, `$$update`, `$$memo`, `$$sync`, `$$effect`, `$$store`, `$$mount` and `$$destroy`. Public: `tick`. Compile-time names: `$$`, `$`, `$sync`, `$skip`, `$store`, `$composable`, `onMount` and `onDestroy`. Each compile-time name stays exported, with its type, and throws `'<name> is meant to be compile-time only.'` when called. In 0.4, `$$` and `$composable` were runtime functions. In 0.5 they throw like the others, because the runtime cannot run a setup without its graph.

- Rejected: the draft's `$$scope(parent, graph, size)`. Compiled code never makes a scope by itself: `$$root`, `$$composable` and the entry helpers make them. The slot count is the graph's length, so `size` is not needed.
- Rejected: dropping the compile-time names from the exports. Users import them for types, and a call without the compiler should fail with a clear message.

### 3. Values live in slots

A reactive variable is a slot of its scope. A read compiles to `$$get(scope, slot)` and a write to `$$set(scope, slot, value)`. Code inside nested functions reads the scope variable through the closure, so it needs no parent chain.

- Rejected: keeping values in JS locals and passing the old and new values to a notify helper. `x++` and destructuring cannot give the runtime the new value without temporaries, and the runtime cannot compare by `Object.is` without both.
- Rejected: emitting `scope.v[slot]` reads inline. It ties compiled code to the scope's shape. After minification `a(s,0)` and `s.v[0]` have the same size, and engines inline the small function.

### 4. Which declarations get a slot

Only top-level declarations of a scope body are reactive, as in 0.4. A declarator gets slots when:

- it is a `let` or `var` written anywhere in the setup tree other than by its own initializer, nested functions included,
- its initializer reads a slot (a memo), for `let`, `const` and `var`, or
- its initializer is `$store(...)`.

"Reads a slot" uses the same reads as entries (decision 13), so `const t = label()` is a memo when `label` reads a slot, and `const u = $skip(a) + 1` is a plain local (fixture `memo-local-call`). The rule is applied to a fixed point.

- A function or arrow initializer, or a `$$` or `$composable` call, is never a memo.
- If one name of a destructuring declarator gets a slot, all its names do. This keeps one compiled form per declarator.
- A top-level `var` follows the rules of `let`. A read before the declaration reads the empty slot, which matches a hoisted `var`. A second `var x = v` is a write. A `var` inside a block stays plain, like a block-level `let` (fixture `var-slot`).
- Everything else stays a plain JS local. Declarations inside nested blocks stay plain, because they can run many times or not at all.
- Rejected: a slot for every top-level declaration, as 0.4 makes every one reactive. It costs a slot and a write for values that never change.
- Rejected: treating `const f = () => count` as a memo, as 0.4 does. The function never changes. Its reads count where it is called (decision 13).
- Rejected: never giving a `var` a slot. A written top-level `var` would silently stop being reactive.

### 5. Graph format

One graph per scope body, emitted as a module-level `const` and shared by every instance:

```ts
type Ref = number | readonly number[];
type Graph = readonly (readonly Ref[] | undefined)[];
```

- `graph[slot]` lists the entries that read the slot. A number is an entry id in the same scope.
- An array `[e1, ..., eN, id]` is a path to an entry of a nested scope: the child scope of entry `e1`'s last run, then the child scope of `e2` in it, and so on, then entry `id` there. A path only goes through entry child scopes, never through composable scopes or nested roots.
- The graph can be shorter than the slot count. A missing list means no entry reads the slot.
- The compiler writes refs in canonical order (numbers ascending, then paths lexicographically), so its output is stable. The runtime orders entries by position (decision 6) and must not depend on list order.
- Graph constants go after the last import of the module. Placed right before the statement that holds the setup, as the first fixtures did, a function declaration called earlier in the module would read them in the temporal dead zone.
- Rejected: brumate's kind-keyed table (`g[kind][slot]`) with entry names. silmaril keeps entry bodies as closures inside the setup, so they need no export names, and a nested scope has at most one live instance per entry, so a path finds it without a kind lookup.
- Rejected: a runtime subscription list per slot, filled when a scope is made. It is a runtime graph again, and it needs cleanup on dispose.

### 6. Entry ids, order and phases

Each scope numbers its entries from 0: memos and store write-backs in declaration order, then `$sync` bodies in declaration order, then `$` bodies in declaration order. Registration still happens in source order.

A write to a slot that changed queues each listed entry that is registered, alive, not queued and not running. Then:

1. If memos are running, it returns. The running memo phase takes the new entries.
2. It runs queued memos and write-backs until none are left.
3. If a `$sync` body is running, it returns. Queued `$sync` bodies run after the outermost running body returns.
4. It runs queued `$sync` bodies one at a time until none are left.
5. It throws the first held error.

The order inside each queue is total: lower depth first. At equal depth, both scopes are walked up to their closest common ancestor and the branches under it are compared: an entry child scope ranks by its entry id, composable scopes come after all entry child scopes in call order, and separate roots rank by creation order. In one scope, the lower id runs first. This is the same order as mount and dispose.

When an entry is taken from a queue and an entry that owns one of its ancestor scopes is queued, it does not run. That ancestor's run will dispose its scope and make a new one.

A running entry is never queued, at any depth. The runtime keeps a running flag per entry, so the rule covers every entry on the call stack.

- Finding 1 of the PR #8 review: "parents run before children" only held inside one queue, so a child `$sync` of a queued `$` ran in the old scope, then again in the new one. The ancestor check fixes it for every phase (fixtures `effect-parent-child`, `child-memo-wasted`).
- Finding 2: a `$sync` body ran its nested `$sync` bodies at once on its first run, but after it returned on later runs. Registration now runs the body as a running `$sync` body, so both runs order their effects the same way (fixture `sync-first-vs-rerun`).
- Finding 5: two scopes at the same depth ran in graph list order, which the contract did not fix. The common-ancestor rule fixes it (fixtures `sibling-order-a`, `sibling-order-b`).
- Finding 6: the self-skip covered only the innermost running entry, so an inner `$sync` that wrote what its parent read ran the parent without end. The running flags stop it after one run (fixtures `parent-child-cycle`, `self-write`).
- Rejected: one queue for memos and `$sync` in id order. A `$sync` that writes and then reads a memo would read a stale value.
- Rejected: FIFO order, as brumate orders bindings. The position order follows the source, so the user can predict it without knowing which write queued what.
- Rejected: requiring the compiler to sort refs and running them in list order (the review's first suggestion). It puts the order in two places and makes a wrong graph produce a different order instead of the same one.
- Rejected: pre-order (depth first) instead of lower depth first. Both are total. Lower depth first keeps the existing rule that parents run before children within a phase, and it is the order the fixtures already use.
- Rejected: running nested `$sync` bodies at once inside a running body, for both first and later runs. It makes the drain re-entrant, so a parent could run again and dispose a child that is still on the stack.
- Rejected: letting an entry run at most once per drain to stop all cycles. A `$sync` that reads two slots written by two other `$sync` bodies must run after each of them.

### 7. `$` runs in a microtask, writes batch, and `tick` waits

The first run of a `$` and every later run are queued. One `queueMicrotask` flush runs all queued `$` bodies in the order of decision 6. A `$` queued while the flush runs, by a write inside a `$`, runs in the same flush. `tick()` returns a promise that resolves at the end of the next flush, after every `$` queued before it ends. It schedules a flush when none is pending, so it also resolves when nothing is queued. It never rejects.

- Several writes in one synchronous run queue a `$` once. It runs once with the final values.
- A queued `$` runs even when later writes put the old values back. 0.4 compared dependency arrays and skipped it. Accepted at the gate. Users who need to skip compare the value in the body.
- Memos and `$sync` do not batch. They run on each write, as in 0.4 (`count = 100; // Logs "Sync Count: 100"`).
- The fixtures import `tick` from `'silmaril'` instead of a free helper of the runner. So `tick` is tested by every fixture that waits, and fixture `tick` covers its edge cases.
- Rejected: `setTimeout`, as in 0.4. It waits for the next task and lets the page render stale values first.
- Rejected: an explicit `batch()` for `$sync`. It is new API with no request for it.
- Rejected: skipping a queued `$` whose read values all returned to their previous values. It needs a copy of every read value per entry, which a static graph avoids.
- Rejected: `tick()` as `new Promise((r) => setTimeout(r))`. It waits a whole task, and it does not resolve after a flush that a later microtask schedules.
- Rejected: rejecting the `tick()` promise with the flush's error. The error would be reported twice, once to the host and once to the caller, and an unawaited `tick()` would become an unhandled rejection.

### 8. `$sync` stays a synchronous effect

`$sync` keeps its 0.4 meaning: a body with side effects that runs during setup and again before each write that changes what it reads returns. It runs after the memos of that write, so it sees settled values. Inside a running `$sync` body, a write runs its memos at once but defers the `$sync` bodies it queues until the outermost body returns. It can own a child scope.

- Rejected: folding `$sync` into memos. Memos run in topological order and have no side effects. A `$sync` among them would run before later memos settle, and the user would read half-updated values. It would also need an output slot it does not have.

### 9. A write of the same value runs nothing

`$$set` compares with `Object.is` and stores nothing and queues nothing when equal. `NaN` equals `NaN`, and `0` differs from `-0`. A memo that computes the same value stops there. Mutating an object in place (`obj.a = 1`) is not a write, as in 0.4.

Each target of a destructuring assignment is its own write, so a `$sync` that reads two targets of `[a, b] = [b, a]` runs once per changed target (fixture `update-expression`). Accepted at the gate.

### 10. Child scopes, re-runs and disposal

Every run of a memo, `$sync` or `$` gets a new child scope, passed to the body. The child scope has the slots of declarations in the body (graph passed as the last argument of `$$sync` or `$$effect`), and owns its lifecycles, entries, stores and composables.

- Before an entry runs again, the child scope of its last run is disposed.
- An entry's own reads are the reads in its argument, minus those inside nested `$`, `$sync` and memo entries and `$skip`. An inner entry that reads an outer slot is listed in the outer graph through a path, so the outer body does not run again (fixture `nested-scope`). Accepted at the gate.
- A body that reads a memo of its own child scope gets the reads of that memo. Otherwise `$sync(() => { const d = x * 2; log(d); })` would never run again, because its only read of `x` is inside the memo (fixture `body-memo`). The body's own `let` and `$store` slots stay out of its reads, because running the body again resets them.
- Disposal sets the scope dead, disposes child scopes of entries in id order, then composable scopes in call order, then runs `onDestroy` callbacks and store unsubscribes in registration order. A queued entry of a dead scope does not run. A second dispose does nothing. A write to a dead scope stores the value and runs nothing.
- Rejected: the 0.4 rule, where a read anywhere in the body, nested `$` included, rebuilds the body. It is one of the listed limits.
- Rejected: creating the child scope only when the body needs one. The compiler cannot tell whether a called function is a composable. runtime-v2 can still allocate the scope's arrays lazily.
- Rejected: a graph ref that means "the owner entry", so that a body runs again when any of its own slots changes. For `let` slots it resets the state the write just set, and for memos it computes the memo twice.

### 11. `onMount` and `onDestroy`

`onMount(fn)` compiles to `$$mount(scope, fn)` and `onDestroy(fn)` to `$$destroy(scope, fn)`, with the scope of the nearest enclosing scope body. Inside a memo initializer or an expression entry, the scope is the run's child scope.

- A scope mounts after its setup returns, once its parent is mounted. Mounting mounts unmounted children first (entry children in id order, then composables), then runs its own callbacks in order. So a child made during the parent's setup mounts with the parent, and a child made later mounts right after its body.
- `$$mount` on a mounted scope runs the callback at once. `$$destroy` on a dead scope runs it at once. `$$mount` on a dead scope does nothing.
- Since the scope is a compiled argument, a lifecycle call after an `await` in an async body still attaches to the right scope.
- Rejected: returning a cleanup from `onMount` or from `$` bodies. It is new API, and `onDestroy` covers it.

### 12. `$store`

`const x = $store(store)` compiles to `$$store(scope, slot, store)`. `let x = $store(store)` compiles to `$$store(scope, slot, store, id)`, where `id` is the write-back entry, numbered with the memos.

- `$$store` stores `store.get()` in the slot and subscribes. The listener writes `store.get()` to the slot with `$$set`. The unsubscribe runs on dispose.
- The write-back runs in the memo phase, with no first run. When a slot write queues it, it calls `store.set(value)` only if `store.get()` differs by `Object.is`, so a value that came from the store is not written back. So the store and its other bindings hold the new value when the write returns, also inside a `$sync` body (fixture `store-writeback-batch`). Finding 2 of the PR #8 review: as a `$sync`, the write-back left the store stale until the writing body returned, and ran the body twice.
- The store expression is evaluated once, at setup, and is not tracked.
- Writing a `let` bound to a store without `set` throws a `TypeError` from the write-back, which the write throws.
- A value that reaches another scope through a store is a new write. The scopes run in the order of decision 6, so an entry that reads values from both sides can see the new input next to the old output, then run again (fixture `composable-glitch`). Accepted at the gate. Finding 7 asked to put it in the contract, and it is there.
- Rejected: write-back inside `$$set` through a per-slot hook. It adds a check to every write. The entry costs nothing for slots without a store.
- Rejected: keeping the write-back a `$sync`. See finding 2 above.

### 13. Local functions

A call by name to a function declared inside the same setup tree (function declarations, and `const` or `let` initialized with a function or arrow expression that have no slot) adds the function's reads to the calling entry. The compiler follows calls inside that function too, to a fixed point, so recursion is fine. Optional calls (`f?.()`) count. The same reads decide whether a declarator is a memo (decision 4).

- A function used as a value (passed, stored, returned) adds nothing (fixture `local-function`).
- Reads in inline function expressions inside an entry count for the entry, as in 0.4. `$skip` opts out.
- Rejected: adding reads for any reference to a local function. brumate also counts calls only. A handler passed to `addEventListener` inside a `$` would make the `$` run again on every change the handler reads.
- Rejected: ignoring reads in inline functions inside an entry. `items.map((item) => item * factor)` would miss `factor`.

### 14. What is not tracked

- Reads inside `$skip(expression)`, including reads through local functions called in it. `$skip(e)` compiles to `(e)`, with reads still compiled to `$$get` (fixture `skip`). A write inside it is still a write.
- Reads inside functions declared outside the setup tree, including imported functions. They cannot name a slot, so this only affects closures passed to them and called later.
- Reads of outer slots inside a nested `$$` or `$composable` (decision 20, fixtures `nested-root`, `nested-root-write`, `nested-composable`).
- The store expression of `$store`.

The 0.4 comment form `/* $skip */` is a compile error in 0.5, with a message that points to `$skip(expression)` (fixture `skip-comment`). In 0.4 it opted a read, a declarator or a write target out of tracking.

- Rejected: keeping the comment. Comment attachment differs between Babel and oxc, formatters move comments, and `$skip()` covers reads. Declarators that are never written are already plain in 0.5.
- Rejected: ignoring the comment. Code that relied on it would start tracking reads, a silent change of meaning.

### 15. `$composable`

`$composable(fn)` compiles to `$$composable(graph, (scope, ...params) => body)`. The returned function has the original parameters and returns what the setup returns.

- A call makes a child scope of the scope that is running (the setup or entry run on the call stack). It is disposed with that scope and mounts with it.
- A call outside any running scope throws an `Error`. So does a call after an `await` in an async body.
- Parameters are plain values, not slots. Reactivity crosses into a composable through stores, as in 0.4.
- A `$composable` declared inside a `$$` body is its own setup tree. Its reads of the outer slots have no edges (fixture `nested-composable`). Finding 7 of the PR #8 review: paths walk entry children only, so those reads could not be listed. A composable can be called many times, so a static path could not name one instance anyway.
- Rejected: running the composable in the caller's scope, as 0.4 does. Its slots and entry ids would collide with the caller's, which the static numbering cannot allow.
- Rejected: a compile error for a `$composable` inside a `$$`. Defining a composable near its use is common, and the rule matches nested `$$`.

### 16. Errors

- An error thrown by a run during a write or a registration is held, and the other queued entries still run. The outermost drain throws the first error once its memos and `$sync` bodies have run (fixture `error`).
- When a run throws, its new child scope is disposed before the error is held: its `onDestroy` callbacks run, its queued `$` bodies never run, and its `onMount` callbacks never run. The entry stays registered (fixture `error-in-rerun`).
- A memo that throws keeps its old value (fixture `memo-throws`).
- When a `$$root` setup throws, the root is disposed, so stores unsubscribe and nothing runs after, and the error is thrown again (fixture `setup-throws`). When a composable setup throws, its scope is disposed and removed from its parent, and the error is thrown again.
- In the `$` flush, errors are caught per body. After the queue is empty and `tick()` promises have resolved, the first error is thrown from the microtask so the host reports it. Each `$` body runs with no phase active, so the drain of its own writes throws into it.
- Finding 4 of the PR #8 review: a throw left live scopes behind, with subscriptions and queued `$` bodies, and a composable that threw was still mounted.
- Rejected: stopping at the first error. It leaves memos stale until their inputs change again.
- Rejected: one held error for both the synchronous drain and the `$` flush. A `$` body that writes after an earlier `$` threw would receive that unrelated error.

### 17. Compile-time rules

- `$` and `$sync` must be expression statements of a scope body, or of a block, `if`, `try`, `switch` or labeled statement in one. A call in a loop is a compile error, because one entry id cannot stand for many registrations (fixture `loop-entry`). A call in a nested function, in an expression, or outside every setup tree is also a compile error (fixture `entry-in-function`). A call inside `if` is fine: an entry that never registered is skipped.
- A write to a slot in a memo initializer is a compile error, outside nested functions and through local functions it calls by name (fixture `memo-writes-slot`). Finding 3 of the PR #8 review: such a write made a memo read a stale memo and compute twice. A write the compiler cannot see, through a function passed as a value, follows the runtime rule: it is queued and runs in the same memo phase (fixture `memo-write-runtime`).
- The contract lists every compile error with the text its message contains. Compile-error fixtures carry that text as `compileError` in `expected.json`, so the codegen tests can check it.
- A read of a slot before its declaration returns `undefined` instead of throwing as the TDZ would.
- A write cycle between different entries does not end. The runtime does not detect it.
- Rejected: allowing writes in memo initializers and documenting the double computation. It breaks the rule that each memo runs once per write, and memos are meant to have no side effects.

### 18. Size

Measured with rolldown 1.2.15 `minify: true` and gzip level 9, every export kept:

| Build                                        | Minified | Gzip   |
| -------------------------------------------- | -------- | ------ |
| 0.4 `src/index.ts`                           | 2064 B   | 770 B  |
| PR #8 sketch, before the review              | 2627 B   | 1278 B |
| Reviewer's patched sketch (findings 1, 2, 6) | 2760 B   | 1309 B |
| Sketch now (`nodes/reactivity-adr/sketch/`)  | 3036 B   | 1434 B |

The cap for `src/v2/index.ts` is 1.5 kB gzip with every export (gate decision 3). The sketch is 66 B under it. The 1.2 kB target is not reachable by the sketch with these rules: the review fixes, `tick`, the total order and the error rules cost 156 B over the first sketch. runtime-v2 can save some of it: the sketch has 17 named fields per scope, eight stub functions with their own error text, and two busy flags written in two places. An app that does not use `$store`, `$composable` or `tick` loses them to tree-shaking.

`take()` scans its queue on each pick, which is quadratic in the queue length per flush. runtime-v2 may use a heap or a sorted insert if the order stays the same. `benchmark-harness` should cover a write that fans out to many entries.

### 19. Compiled forms

The contract's table is exact. The rules that the review of PR #9 asked to fix:

- A compound assignment parenthesizes its right side: `x *= a + b` is `$$set($s, k, $$get($s, k) * (a + b))`. A logical assignment is a parenthesized short circuit: `($$get($s, k) || $$set($s, k, v))`, so it stays one operand in `1 + (x ||= 3)` (fixture `compound-assignment`).
- `x = y = 1` is `$$set($s, k, $$set($s, j, 1))`. The inner write runs its entries first, as `y = 1; x = 1` would (fixture `chained-write`).
- A destructuring write keeps the pattern in place and puts a temp in each slot target: `([$t1, $t2] = $t0 = e, $$set($s, k, $t1), $$set($s, j, $t2), $t0)`. Defaults, nesting, rest, holes, computed keys and member targets stay as written, and a default that reads an earlier target reads its temp. In statement position the right-side temp is dropped and the writes become statements. Temps are per site and declared at the start of the nearest enclosing function (fixture `destructure-assign`).
- A `for-of` or `for-in` loop with a slot target loops over a fresh `const` temp and writes the slot first in each iteration (fixture `for-of-slot`).
- Generated names must not collide with any identifier of the module and must not shadow another generated name used inside them. The fixtures use `$c0_1` for nested child scopes.
- Rejected: the first fixtures' form `($t = e, $$set($s, k, $t[0]), ...)`. It rebuilds the pattern, which cannot express defaults, rest or member targets without an object-rest helper, and one `$t` per setup is overwritten by a nested destructuring in a default.

### 20. Nested `$$`

A nested `$$` does not track outer variables. Its reads of outer slots compile to `$$get` on the outer scope, so they see the current value when they run, and its writes to outer slots run the outer entries (fixture `nested-root-write`). An outer write never runs anything inside it (fixture `nested-root`).

The reason is that a nested `$$` is not a child of anything. It returns its own disposer and is not disposed with the outer scope, as in 0.4. It can be created any number of times, for example in an event handler, so many instances can be alive at once. A graph path names at most one live child per entry, and the static graph has no place for a list of instances. Tracking would need a runtime subscription per read, which decision 5 rejects. A user who wants a nested root to follow an outer value passes a store, as with composables.

- Rejected: tracking outer reads through runtime subscriptions made when the nested root registers. It is a runtime graph with cleanup, for one construct.
- Rejected: making a nested `$$` a child scope of the scope that creates it. It changes the 0.4 lifetime, which the `nested-root` fixture keeps, and two independent roots would become one.

## Breaking changes from 0.4

These go in the 0.5.0 changeset:

- A `$` or `$sync` body runs again only for reads outside its nested entries. Nested `$` and `$sync` track outer variables on their own.
- `$` runs in a microtask instead of a `setTimeout`. `tick()` waits for it.
- A queued `$` runs even if the values it read returned to their old values before the flush.
- Only top-level declarations that are written, read a reactive value, or bind a store are reactive. Others are plain values. Block-level declarations in a setup are never reactive.
- `const f = () => ...` is never a computed. Calls to local functions add what they read.
- `$composable` gets its own scope instead of sharing the caller's. Calling it outside a reactive scope throws.
- A destructuring assignment writes each target separately.
- A value passed between scopes through a store is a new write in the receiving scope.
- A `$sync` that writes inside its body defers the `$sync` bodies it queues until it returns.
- An entry is not queued by writes made while it runs, also by entries nested in it.
- `$skip(expression)` works. The `/* $skip */` comment is a compile error.
- `$` and `$sync` in loops, in nested functions or outside a setup are compile errors. So is a write to a reactive variable in the initializer of a derived value.
- `$$` and `$composable` throw when called without the compiler.

## Still open

- Size: the sketch is 1434 B gzip, under the cap and above the 1.2 kB target. The maintainer can accept the target as missed or ask runtime-v2 for a size pass.
- The compile-error choice for `/* $skip */` (decision 14). Ignoring the comment is the other option, with a silent change of meaning.
- The compiler-api contract (PR #9) still describes the 0.4 analysis model. It needs the slot, entry, reads and graph rules of this contract before codegen starts.
