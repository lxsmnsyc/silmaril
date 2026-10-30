# 0001: Static-graph runtime for silmaril 0.5

- Status: proposed, revised after the gate and after the follow-up decisions. The maintainer's decisions are applied, and so are the findings of the runtime design review of PR #8, the "reactivity-runtime" section of the compiler design review of PR #9, and the change requests of the PR #9 compiler spike. The contract is ready to freeze.
- Node: `reactivity-adr`. Contract: `contracts/reactivity-runtime.md` (proposed text, version 4, in `nodes/reactivity-adr/proposed-reactivity-runtime.md`).
- Fixtures: `packages/silmaril/test/runtime/fixtures/` (61). A reference sketch that passes them is in `nodes/reactivity-adr/sketch/`.

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
- Queued entries run in one total order: lower depth first, then by position under the closest common ancestor. An entry whose ancestor entry is queued does not run. An entry that writes what it reads runs again after it returns, as in 0.4. A loop guard stops a drain or a `$` flush after 10000 entry runs with `Error('Update loop')`.
- Nothing is tracked at run time. The runtime only follows the lists.

## Gate decisions

The maintainer decided these at the gate (PR #8, comment "Maintainer decisions at the gate"):

1. Accepted: outer bodies no longer run again for reads inside nested `$` and `$sync` (decision 10). `switch-to-v2` rewrites the README nested example.
2. Accepted: a queued `$` still runs when a later write in the same task restores the old value (decision 7).
3. Size: 1.5 kB gzip is a hard cap. About 1.2 kB is the target (decision 18).
4. Added: a public `tick(): Promise<void>` that resolves after queued `$` bodies have run (decision 7, fixture `tick`).
5. Accepted for the 0.5.0 changeset: reactive declarations limited to those that are written, read a reactive value or bind a store; `$composable` gets its own scope; `$` and `$sync` in loops are compile errors; destructuring writes each target separately; a store passing a value between scopes counts as a new write.
6. Left open for this record: does a nested `$$` track outer variables? Answered in decision 20: no.

Follow-up decisions (PR #8, the two comments "Maintainer decisions on the follow-up questions" and "Maintainer decisions, continued"):

7. `runtime-v2` does a size pass toward 1.2 kB. The 1.5 kB cap stays.
8. The `/* $skip */` comment stays a compile error (decision 14).
9. A loop guard modeled on brumate's (decision 21).
10. The `body-memo` rule stays, because it keeps the 0.4 behavior (decision 10).
11. Backwards compatibility comes first. Where a rule is open, or two rules are equally sound, the design takes the behavior closest to 0.4. Each change from 0.4 has a reason in "Changes from 0.4" below.

## Decisions

### 1. Import specifier

Compiled code imports every helper from `'silmaril'`, as 0.4 does. The compiler removes the compile-time names (`$$`, `$`, `$sync`, `$skip`, `$store`, `$composable`, `onMount`, `onDestroy`) from the user's named imports and adds one import with the helpers it uses. Other specifiers, such as `tick` and the `Store` type, stay.

- While the new runtime lives in `src/v2/`, the fixture runner and the behavior-suite `Pipeline.runtime` map `'silmaril'` to the namespace of `src/v2/index.ts`. `switch-to-v2` makes the `.` entry export it.
- Rejected: a separate specifier such as `'silmaril/runtime'`. It adds an entry to `package.json` and `tsdown.config.ts` (shared files), and users would see two entries for one runtime.
- Rejected: `'silmaril/v2'` during the transition. Every fixture and codegen test would change at the switch.

### 2. Exports

Helpers: `$$root`, `$$composable`, `$$get`, `$$set`, `$$update`, `$$memo`, `$$sync`, `$$effect`, `$$store`, `$$mount` and `$$destroy`. Public: `tick`. Compile-time names: `$$`, `$`, `$sync`, `$skip`, `$store`, `$composable`, `onMount` and `onDestroy`. Each stays exported, with its type. As in 0.4, `$$` and `$composable` also run without the compiler: `$$` runs the setup at once in a root scope with an empty graph and returns its disposer, and `$composable` returns the setup. So a call through a namespace import, which the compiler leaves as is, behaves as in 0.4 (fixture `namespace-root`). The others throw `'<name> is meant to be compile-time only.'` when called.

- Rejected: the draft's `$$scope(parent, graph, size)`. Compiled code never makes a scope by itself: `$$root`, `$$composable` and the entry helpers make them. The slot count is the graph's length, so `size` is not needed.
- Rejected: dropping the compile-time names from the exports. Users import them for types, and a call without the compiler should fail with a clear message.
- Rejected: `$$` and `$composable` that throw, as the first version of this record had. A setup runs fine with an empty graph, so throwing broke 0.4 code for no gain.

### 3. Values live in slots

A reactive variable is a slot of its scope. A read compiles to `$$get(scope, slot)` and a write to `$$set(scope, slot, value)`. Code inside nested functions reads the scope variable through the closure, so it needs no parent chain.

- Rejected: keeping values in JS locals and passing the old and new values to a notify helper. `x++` and destructuring cannot give the runtime the new value without temporaries, and the runtime cannot compare by `Object.is` without both.
- Rejected: emitting `scope.v[slot]` reads inline. It ties compiled code to the scope's shape. After minification `a(s,0)` and `s.v[0]` have the same size, and engines inline the small function.

### 4. Which declarations get a slot

Declarations of a scope body are reactive, also in nested blocks, as in 0.4, except inside nested functions and loops. The contract calls them setup declarations. A declarator gets slots when:

- it is a `let` or `var` written anywhere in the module other than by its own initializer, nested functions and nested `$$` included,
- its initializer reads a slot (a memo), for `let`, `const` and `var`, or
- its initializer is `$store(...)`.

"Reads a slot" uses the same reads as entries (decision 13), so `const t = label()` is a memo when `label` reads a slot, and `const u = $skip(a) + 1` is a plain local (fixture `memo-local-call`). The rule is applied to a fixed point.

- A function or arrow initializer that reads a slot is a memo, as in 0.4. Its value is a new function when a read slot changes, so an entry that passes it runs again (fixture `function-memo`). A `$$` or `$composable` call is never a memo.
- If one name of a destructuring declarator gets a slot, all its names do. This keeps one compiled form per declarator.
- A `var` follows the rules of `let`. A read before the declaration reads the empty slot, which matches a hoisted `var`. A second `var x = v` is a write. A `var` inside a block outside loops gets a slot like a block-level `let` (fixture `var-slot`).
- A declaration in an `if`, `try`, `switch` or plain block is reactive, as in 0.4 (fixture `block-slot`). The block runs at most once per scope run, so one slot is enough. A memo or store in a block that did not run never registers, like an entry in an `if`.
- A declaration inside a loop stays a plain JS local. One slot cannot hold a binding per iteration.
- Everything else stays a plain JS local.
- Rejected: a slot for every top-level declaration, as 0.4 makes every one reactive. It costs a slot and a write for values that never change.
- Rejected: never treating `const f = () => count` as a memo, as the first version of this record did. It changed what an entry that passes `f` does, and the 0.4 rule works as well.
- Rejected: keeping only top-level declarations reactive, as the first version did. A block that is not in a loop runs once per scope run, so the 0.4 rule works as well.
- Rejected: never giving a `var` a slot. A written top-level `var` would silently stop being reactive.

### 5. Graph format

One graph per scope body, emitted as a module-level `const` and shared by every instance:

```ts
type Ref = number | readonly number[];
type Graph = readonly (readonly Ref[] | undefined)[];
```

- `graph[slot]` lists the entries that read the slot. A number is an entry id in the same scope.
- An array `[e1, ..., eN, id]` is a path to an entry of a nested scope: the child scope of entry `e1`'s last run, then the child scope of `e2` in it, and so on, then entry `id` there. A path only goes through entry child scopes, never through composable scopes or nested roots.
- The graph can be shorter than the slot count. A missing list means no entry reads the slot. The compiler leaves out trailing empty lists, so a graph with no edges is `[]` (change request 4 of the PR #9 spike).
- The compiler writes refs in canonical order (numbers ascending, then paths lexicographically), so its output is stable. The runtime orders entries by position (decision 6) and must not depend on list order.
- Graph constants go after the last import of the module. Placed right before the statement that holds the setup, as the first fixtures did, a function declaration called earlier in the module would read them in the temporal dead zone.
- Rejected: brumate's kind-keyed table (`g[kind][slot]`) with entry names. silmaril keeps entry bodies as closures inside the setup, so they need no export names, and a nested scope has at most one live instance per entry, so a path finds it without a kind lookup.
- Rejected: a runtime subscription list per slot, filled when a scope is made. It is a runtime graph again, and it needs cleanup on dispose.

### 6. Entry ids, order and phases

Each scope numbers its entries from 0: memos and store write-backs in declaration order, then `$sync` bodies in declaration order, then `$` bodies in declaration order. Registration still happens in source order.

A write to a slot that changed queues each listed entry that is registered, alive and not queued. Then:

1. If memos are running, it returns. The running memo phase takes the new entries.
2. It runs queued memos and write-backs until none are left.
3. If a `$sync` body is running, it returns. Queued `$sync` bodies run after the outermost running body returns.
4. It runs queued `$sync` bodies one at a time until none are left.
5. It throws the first held error.

The order inside each queue is total: lower depth first. At equal depth, both scopes are walked up to their closest common ancestor and the branches under it are compared: an entry child scope ranks by its entry id, composable scopes come after all entry child scopes in call order, and separate roots rank by creation order. In one scope, the lower id runs first. Mount and dispose follow registration order instead, as in 0.4 (decisions 10 and 11).

When an entry is taken from a queue and an entry that owns one of its ancestor scopes is queued, it does not run. That ancestor's run will dispose its scope and make a new one.

An entry that is running can be queued, as in 0.4, where a write inside a body ran it again. It runs again after it returns, because the drain of its phase is the one that called it. So a body that writes what it reads runs until the value settles (fixtures `self-write`, `parent-child-cycle`, `store-writeback-batch`). A cycle that does not settle hits the loop guard (decision 21).

- Finding 1 of the PR #8 review: "parents run before children" only held inside one queue, so a child `$sync` of a queued `$` ran in the old scope, then again in the new one. The ancestor check fixes it for every phase (fixtures `effect-parent-child`, `child-memo-wasted`).
- Finding 2: a `$sync` body ran its nested `$sync` bodies at once on its first run, but after it returned on later runs. Registration now runs the body as a running `$sync` body, so both runs order their effects the same way (fixture `sync-first-vs-rerun`).
- Finding 5: two scopes at the same depth ran in graph list order, which the contract did not fix. The common-ancestor rule fixes it (fixtures `sibling-order-a`, `sibling-order-b`).
- Finding 6: the self-skip covered only the innermost running entry, so an inner `$sync` that wrote what its parent read ran the parent without end. Version 3 added running flags so no running entry was queued. Version 4 drops the self-skip: with the loop guard, the 0.4 rule works as well. A body that settles reaches the same values as in 0.4, and one that does not settle throws `Update loop` instead of running without end.
- Rejected: one queue for memos and `$sync` in id order. A `$sync` that writes and then reads a memo would read a stale value.
- Rejected: FIFO order, as brumate orders bindings. The position order follows the source, so the user can predict it without knowing which write queued what.
- Rejected: requiring the compiler to sort refs and running them in list order (the review's first suggestion). It puts the order in two places and makes a wrong graph produce a different order instead of the same one.
- Rejected: pre-order (depth first) instead of lower depth first. Both are total. Lower depth first keeps the existing rule that parents run before children within a phase, and it is the order the fixtures already use.
- Rejected: running nested `$sync` bodies at once inside a running body, for both first and later runs. It makes the drain re-entrant, so a parent could run again and dispose a child that is still on the stack.
- Rejected: keeping the self-skip of version 3, where a running entry is never queued. A clamp such as `$sync(() => { if (x < 3) x += 1; })` stopped at 1, where 0.4 reaches 3, and the guard now catches the cycles the self-skip was for.
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
- Disposal sets the scope dead, disposes child scopes of entries in registration order, which is source order (fixture `dispose-order`), then runs `onDestroy` callbacks and store unsubscribes in registration order, with each composable scope disposed at the place of its call among them (fixture `composable-lifecycle`). This is the 0.4 order: 0.4 kept child instances by registration index, and a composable's callbacks were in its caller's list. A queued entry of a dead scope does not run. A second dispose does nothing. A write to a dead scope stores the value and runs nothing.
- Rejected: the 0.4 rule, where a read anywhere in the body, nested `$` included, rebuilds the body. It is one of the listed limits.
- Rejected: disposing child scopes in entry id order, as version 3 did. Ids put memos and `$sync` bodies before `$` bodies, so the order differed from 0.4 for no gain.
- Rejected: creating the child scope only when the body needs one. The compiler cannot tell whether a called function is a composable. runtime-v2 can still allocate the scope's arrays lazily.
- Rejected: a graph ref that means "the owner entry", so that a body runs again when any of its own slots changes. For `let` slots it resets the state the write just set, and for memos it computes the memo twice.

### 11. `onMount` and `onDestroy`

`onMount(fn)` compiles to `$$mount(scope, fn)` and `onDestroy(fn)` to `$$destroy(scope, fn)`, with the scope of the nearest enclosing scope body. Inside a memo initializer or an expression entry, the scope is the run's child scope.

- As in 0.4, a root mounts after its setup returns, and an entry child scope mounts right after its run, also during the parent's setup (fixture `lifecycle`). A composable scope mounts at the place of its call among the parent's callbacks: at once when the parent is mounted, otherwise when the parent mounts, between the callbacks registered before and after the call (fixture `composable-lifecycle`). In 0.4 the composable's callbacks were in its caller's list, so this keeps their order.
- `$$mount` on a mounted scope runs the callback at once. `$$destroy` on a dead scope runs it at once. `$$mount` on a dead scope does nothing.
- Since the scope is a compiled argument, a lifecycle call after an `await` in an async body still attaches to the right scope.
- Rejected: returning a cleanup from `onMount` or from `$` bodies. It is new API, and `onDestroy` covers it.
- Rejected: mounting a child only once its parent is mounted, as version 3 did. It moved `onMount` of a `$sync` body run during setup to after the setup, unlike 0.4, and nothing needed it.

### 12. `$store`

`const x = $store(store)` compiles to `$$store(scope, slot, store)`. `let x = $store(store)` compiles to `$$store(scope, slot, store, id)`, where `id` is the write-back entry, numbered with the memos.

- `$$store` stores `store.get()` in the slot, runs the write-back once when there is one, and subscribes. The listener writes `store.get()` to the slot with `$$set`. The unsubscribe runs on dispose.
- The write-back runs in the memo phase. As in 0.4, it runs once at registration and on every change of its slot, also a change that came from the store, and calls `store.set(value)` each time (fixture `store-echo`). The write-back reads its own slot, so the graph lists it there. The store and its other bindings hold the new value when the write returns, also inside a `$sync` body (fixture `store-writeback-batch`). Finding 2 of the PR #8 review: as a `$sync`, the write-back left the store stale until the writing body returned, and ran the body twice.
- The store expression is evaluated once, at setup, and is not tracked.
- A `let` bound to a store without `set` throws a `TypeError` from the first run of the write-back, so the setup throws, as in 0.4.
- A value that reaches another scope through a store is a new write. The scopes run in the order of decision 6, so an entry that reads values from both sides can see the new input next to the old output, then run again (fixture `composable-glitch`). Accepted at the gate. Finding 7 asked to put it in the contract, and it is there.
- Rejected: write-back inside `$$set` through a per-slot hook. It adds a check to every write. The entry costs nothing for slots without a store.
- Rejected: keeping the write-back a `$sync`. See finding 2 above.
- Rejected: a write-back with no first run that skips `store.set` when the store already holds the value, as version 3 had. It changed what a store that does not compare values sees, and the 0.4 rule works as well. Stores that compare, such as `silmaril/store` and Solid signals, see no difference.

### 13. Local functions

A call by name to a function declared inside the same setup tree (function declarations, and `const` or `let` initialized with a function or arrow expression) adds the function's reads to the calling entry. A binding that is written anywhere, or that has a slot, is opaque: a call to it adds only the read of its slot (fixture `written-function`, change request 7 of the PR #9 spike). An arrow that reads a slot is a memo (decision 4), so it is opaque too, and a call to it reads the memo, which reads the same values. The compiler follows calls inside that function too, to a fixed point, so recursion is fine. Optional calls (`f?.()`) count. The same reads decide whether a declarator is a memo (decision 4).

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
- A call outside any running scope throws `Error('Unexpected missing reactive boundary.')`, the 0.4 message. So does a call after an `await` in an async body.
- Parameters are plain values, not slots. Reactivity crosses into a composable through stores, as in 0.4.
- A `$composable` declared inside a `$$` body is its own setup tree. Its reads of the outer slots have no edges (fixture `nested-composable`). Finding 7 of the PR #8 review: paths walk entry children only, so those reads could not be listed. A composable can be called many times, so a static path could not name one instance anyway.
- Rejected: running the composable in the caller's scope, as 0.4 does. Its slots and entry ids would collide with the caller's, which the static numbering cannot allow.
- Rejected: a compile error for a `$composable` inside a `$$`. Defining a composable near its use is common, and the rule matches nested `$$`.

### 16. Errors

- An error thrown by a run during a write or a registration is held, and the other queued entries still run. The outermost drain throws the first error once its memos and `$sync` bodies have run (fixture `error`).
- When a run throws, its new child scope is disposed before the error is held: its `onDestroy` callbacks run, its queued `$` bodies never run, and its `onMount` callbacks never run. The entry stays registered (fixture `error-in-rerun`).
- A memo that throws keeps its old value (fixture `memo-throws`).
- When a `$$root` setup throws, the root is disposed, so stores unsubscribe and nothing runs after, and the error is thrown again (fixture `setup-throws`). When a composable setup throws, its scope is disposed and never added to its parent, and the error is thrown again.
- The loop guard's `Error('Update loop')` is held like any other error (decision 21).
- In the `$` flush, errors are caught per body. After the queue is empty and `tick()` promises have resolved, the first error is thrown from the microtask so the host reports it. Each `$` body runs with no phase active, so the drain of its own writes throws into it.
- Finding 4 of the PR #8 review: a throw left live scopes behind, with subscriptions and queued `$` bodies, and a composable that threw was still mounted.
- Rejected: stopping at the first error. It leaves memos stale until their inputs change again.
- Rejected: one held error for both the synchronous drain and the `$` flush. A `$` body that writes after an earlier `$` threw would receive that unrelated error.

### 17. Compile-time rules

- `$` and `$sync` can be called anywhere in a scope body outside nested functions and loops, as in 0.4: as a statement, inside `if`, `try` or `switch`, or inside an expression such as `a && $(x)` (fixture `entry-in-expression`). An entry that never registered is skipped. A call in a loop is a compile error, because one entry id cannot stand for many registrations (fixture `loop-entry`). A call in a nested function, in a memo initializer, in the argument of another entry, or outside every setup tree is also a compile error (fixture `entry-in-function`). 0.4 left a call in a nested function as is, so it threw when it ran.
- A write to a slot in a memo initializer is allowed, as in 0.4. It follows the runtime rule: it is queued and runs in the same memo phase, so the memo can read a stale memo and compute twice (fixtures `memo-writes-slot`, `memo-write-runtime`). Finding 3 of the PR #8 review offered a compile error or this rule. Version 3 took the compile error. Version 4 takes the rule, because 0.4 code that writes in a derived value keeps working and the runtime already handles it.
- The contract lists every compile error with the text its message contains. Compile-error fixtures carry that text as `compileError` in `expected.json`, so the codegen tests can check it.
- `$$` and `$composable` with an argument that is not a function or arrow expression are a compile error, as in 0.4 (fixture `root-argument`). A reactive variable used as a JSX tag name is a compile error, because a tag name cannot be replaced with `$$get` (fixture `jsx-tag`). Both are change request 6 of the PR #9 spike.
- Where 0.4 had a compile error for the same case, the message keeps the 0.4 text: `<name> can only accept a single argument` (fixture `entry-arguments`) and `$store is only limited to identifiers.` (fixture `store-pattern`).
- A read of a slot before its declaration returns `undefined` instead of throwing as the TDZ would.
- Rejected: a compile error for writes in memo initializers, as version 3 had. It rejected 0.4 code that works.

### 18. Size

Measured with rolldown 1.2.15 `minify: true` and gzip level 9, every export kept:

| Build                                        | Minified | Gzip   |
| -------------------------------------------- | -------- | ------ |
| 0.4 `src/index.ts`                           | 2064 B   | 770 B  |
| PR #8 sketch, before the review              | 2627 B   | 1278 B |
| Reviewer's patched sketch (findings 1, 2, 6) | 2760 B   | 1309 B |
| Sketch version 3                             | 3036 B   | 1434 B |
| Sketch now (`nodes/reactivity-adr/sketch/`)  | 3096 B   | 1481 B |

The cap for `src/v2/index.ts` is 1.5 kB gzip with every export (gate decision 3). The sketch is 19 B under it. Version 4 adds 47 B: the loop guard, the `$$` and `$composable` runtime functions, the registration order list and the composable markers in the lifecycle lists. Dropping the running flags and the write-back's equality check saves some of it. The 1.2 kB target is not reachable by the sketch with these rules: the review fixes, `tick`, the total order and the error rules cost 156 B over the first sketch. runtime-v2 can save some of it: the sketch has 17 named fields per scope, eight stub functions with their own error text, and two busy flags written in two places. An app that does not use `$store`, `$composable` or `tick` loses them to tree-shaking.

`take()` scans its queue on each pick, which is quadratic in the queue length per flush. runtime-v2 may use a heap or a sorted insert if the order stays the same. `benchmark-harness` should cover a write that fans out to many entries.

### 19. Compiled forms

The contract's table is exact. The rules that the review of PR #9 asked to fix:

- A compound assignment parenthesizes its right side: `x *= a + b` is `$$set($s, k, $$get($s, k) * (a + b))`. A logical assignment is a parenthesized short circuit: `($$get($s, k) || $$set($s, k, v))`, so it stays one operand in `1 + (x ||= 3)` (fixture `compound-assignment`).
- `x = y = 1` is `$$set($s, k, $$set($s, j, 1))`. The inner write runs its entries first, as `y = 1; x = 1` would (fixture `chained-write`).
- A destructuring write keeps the pattern in place and puts a temp in each slot target: `([$t1, $t2] = $t0 = e, $$set($s, k, $t1), $$set($s, j, $t2), $t0)`. Defaults, nesting, rest, holes, computed keys and member targets stay as written, and a default that reads an earlier target reads its temp. In statement position the right-side temp is dropped and the writes become statements. Temps are per site and declared at the start of the nearest enclosing function (fixture `destructure-assign`).
- A `for-of` or `for-in` loop with a slot target loops over a fresh `const` temp and writes the slot first in each iteration. A pattern target stays in place with its slot targets renamed to temps of the site: `for ([$t1, $t2] of e) { $$set(...); body }` (fixture `for-of-slot`). The first form moved the pattern into the body, which needs magic-string `move` (change request 5 of the PR #9 spike).
- A destructuring write directly in a class field initializer is wrapped in an arrow called at once, which declares the temps (fixture `class-field-destructure`). The arrow keeps `this`. Version 3 made it a compile error. 0.4 compiled it.
- A memo initializer or expression entry that is an object literal or a sequence gets parentheses after `() =>` (fixture `object-memo`, change request 9).
- The compiler may merge its helpers into the user's import from `'silmaril'` or add a new import. Merging is preferred, because the 0.4 Babel plugin's output does that (change request 8).
- Generated names must not collide with any identifier of the module and must not shadow another generated name used inside them. The fixtures use `$c0_1` for nested child scopes.
- Rejected: the first fixtures' form `($t = e, $$set($s, k, $t[0]), ...)`. It rebuilds the pattern, which cannot express defaults, rest or member targets without an object-rest helper, and one `$t` per setup is overwritten by a nested destructuring in a default.

### 20. Nested `$$`

A nested `$$` does not track outer variables. Its reads of outer slots compile to `$$get` on the outer scope, so they see the current value when they run, and its writes to outer slots run the outer entries (fixture `nested-root-write`). An outer write never runs anything inside it (fixture `nested-root`).

The reason is that a nested `$$` is not a child of anything. It returns its own disposer and is not disposed with the outer scope, as in 0.4. It can be created any number of times, for example in an event handler, so many instances can be alive at once. A graph path names at most one live child per entry, and the static graph has no place for a list of instances. Tracking would need a runtime subscription per read, which decision 5 rejects. A user who wants a nested root to follow an outer value passes a store, as with composables.

- Rejected: tracking outer reads through runtime subscriptions made when the nested root registers. It is a runtime graph with cleanup, for one construct.
- Rejected: making a nested `$$` a child scope of the scope that creates it. It changes the 0.4 lifetime, which the `nested-root` fixture keeps, and two independent roots would become one.

### 21. Loop guard

Maintainer decision 9 asked for a guard modeled on brumate's (`packages/brumate/src/runtime/client/updates.ts`, `drain`, `queue`, `stuck` and `failed`).

- The outermost synchronous drain counts the entries it takes from the memo and `$sync` queues, through every drain nested in it. When the count passes 10000, each entry taken after that throws `Error('Update loop')` in place of running. The first one is held like any other error and the others are dropped, so the rest of the drain runs nothing and its queues empty. The outermost drain throws the held error, so it reaches the caller of the write, or of `$$root` when the loop starts during setup (fixture `update-loop`).
- Reset: the count goes back to 0 when the outermost drain ends, whether it failed or not. The entries left in the queues were taken and cleared, so a write after the failed drain starts fresh and runs its entries as usual.
- The `$` flush has its own count, with the same limit. It counts the `$` bodies that ran before, so a first run does not count, and mounting many new `$` bodies in one flush does not trip it. Past the limit, each `$` taken throws `Update loop` in place of running, and the flush throws the first error from the microtask after `tick()` promises resolve. A write inside a `$` body runs its own synchronous drain with the synchronous count.
- A cycle that settles is fine: the last write stores the value the slot holds and queues nothing (fixture `two-way-binding`).
- The message is `Update loop`, brumate's production message. silmaril has no development build for the longer text.
- Like brumate: one count per pass, the next update fails in place of running, the rest of the pass stops, and the count resets when the outermost pass ends. Unlike brumate, which counts rounds of bindings, silmaril has no rounds, so it counts entry runs, as the maintainer asked. So one write that fans out to more than 10000 entries in one drain throws too. `benchmark-harness` should show how far real apps are from it.
- Rejected: no guard. A cycle between `$sync` bodies hung the page, and a cycle between `$` bodies ran microtasks without end. With decision 6, a body that writes what it reads runs again, so more code can loop.
- Rejected: a depth limit. Drains are not re-entrant, so a cycle between `$sync` bodies runs in one loop at one depth and a depth limit never trips. A limit on stack depth would only catch chains of nested writes, which already end in a `RangeError`.
- Rejected: a limit per entry. It needs a counter on every entry and a cleanup after every drain.
- Rejected: one count for the synchronous drain and the `$` flush. A write in a `$` body starts and ends a drain inside the flush, so its reset would reset the flush's count.
- Rejected: letting `Update loop` replace an error that was held before it. The first held error wins everywhere else in this design.

## Changes from 0.4

The 0.5.0 changeset is written from this list. 0.4 here is `packages/silmaril/src/index.ts` and `packages/silmaril/babel/index.ts` with the fixes of PR #5, so `$skip(expression)` already works in 0.4. Additions with no 0.4 behavior to change are not listed: `tick()`, a `$$` with an expression body, and `$sync` and `$` with an expression body that 0.4 left uncompiled.

### (a) Accepted by the maintainer at the gate

1. A `$` or `$sync` body runs again only for reads outside its nested `$` and `$sync` entries. Nested entries track outer variables on their own (decision 10).
2. A queued `$` runs even if the values it read returned to their old values before the flush (decision 7).
3. Only declarations that are written, read a reactive value, or bind a store are reactive. Others are plain values (decision 4).
4. `$composable` gets its own scope instead of sharing the caller's instance (decision 15). Its callbacks still run at the place of the call (see (c) 9), but its entries' child scopes are disposed with the composable, not with the caller's other child scopes.
5. `$` and `$sync` inside loops are compile errors (decision 17).
6. A destructuring assignment writes each target separately, so a `$sync` that reads two targets runs once per changed target (decision 9).
7. A value passed between scopes through a store is a new write in the receiving scope (decision 12).
8. The `/* $skip */` comment is a compile error (decision 14, follow-up decision 8).

### (b) Needed by the static graph model

Some of these fix the 0.4 limits that the `reactivity-adr` brief lists. They are marked "brief".

1. A write runs only the entries that read the written variable. 0.4 ran and compared every `$sync` and computed of the instance on every write (brief). This is the model itself.
2. Memos run before `$sync` bodies, in declaration order, which is a topological order (decision 6). 0.4 ran computeds and `$sync` bodies in one list in source order, so a computed could read a stale value (brief). With no dependency arrays to compare, each entry runs once per write, so it must run after its inputs settle.
3. A call by name to a local function adds what the function reads (decision 13). 0.4 did not track reads in called function declarations, such as `prefix` in the README example (brief). The static graph needs the reads at compile time, and following calls is how it gets them.
4. An error in one entry does not stop the others. The first error is thrown after the drain (decision 16). In 0.4 the error stopped the other `$sync` bodies, and they caught up at the next write, because every write compared every entry. In 0.5 a skipped entry would stay stale until its own inputs change.
5. Declarations inside loops are plain locals, and `$store` in a loop is a compile error. 0.4 tracked them. One slot cannot hold a binding per iteration.
6. A read of a reactive variable before its declaration returns `undefined`. 0.4 threw the TDZ `ReferenceError`. A slot cannot tell "not declared yet" from `undefined` without a check on every read. Only code that threw in 0.4 sees it.
7. `$` runs in one microtask flush for all scopes instead of one `setTimeout` per instance (decision 7, brief). One flush for all scopes needs one order, so `$` bodies of different scopes run in the total order of decision 6. In 0.4 each instance flushed in its own timeout, so a child's `$` could run before its parent's.
8. A reactive variable used as a JSX tag name is a compile error. 0.4 did not see JSX tags and read the JS local. In 0.5 the value lives in a slot, and a tag name cannot be replaced with `$$get`.
9. Code that 0.4 left as is and that throws when it runs is a compile error: `$` or `$sync` in a nested function, `$skip`, `onMount` or `onDestroy` outside a setup, and a compile-time name used other than as a call. A call in a nested function has no fixed scope or entry id.
10. Messages of new compile errors are new. Where 0.4 had an error for the same case, the 0.4 text stays (see (c) 12). `$$` or `$composable` with a non-function argument says `<name> must be called with a function.`, the text of change request 6 of the PR #9 spike. 0.4 threw `<name> argument must be ArrowFunctionExpression or FunctionExpression` for it.

### (c) Free choices

Switched to the 0.4 behavior, each with a fixture:

1. An entry that writes what it reads runs again after it returns, until the value settles. Version 3 never queued a running entry (decision 6; fixtures `self-write`, `parent-child-cycle`, `store-writeback-batch`). The loop guard makes this safe.
2. Declarations in `if`, `try`, `switch` and plain blocks are reactive (decision 4; fixtures `block-slot`, `var-slot`). Version 3 made only top-level declarations reactive.
3. A function or arrow initializer that reads a reactive value is a memo, so passing it to an entry tracks it (decision 4; fixtures `function-memo`, `local-function`).
4. `$` and `$sync` can be called inside an expression, such as `a && $(x)` (decision 17; fixture `entry-in-expression`).
5. A memo initializer can write a reactive variable (decision 17; fixture `memo-writes-slot`).
6. A destructuring write in a class field initializer works (decision 19; fixture `class-field-destructure`).
7. A child scope mounts right after its run, also during its parent's setup (decision 11; fixture `lifecycle`).
8. Dispose runs child scopes in registration order, not entry id order (decision 10; fixture `dispose-order`).
9. A composable's `onMount` and `onDestroy` callbacks run at the place of its call among the caller's callbacks (decisions 10 and 11; fixture `composable-lifecycle`).
10. A store write-back calls `store.set` at registration and on every change of its variable, also one that came from the store (decision 12; fixture `store-echo`). So a `let` bound to a store without `set` throws at setup, as in 0.4.
11. `$$` and `$composable` run without the compiler, with no reactivity (decision 2; fixture `namespace-root`).
12. 0.4 error messages: `Unexpected missing reactive boundary.` for a composable called outside a scope (fixture `composable`), `<name> can only accept a single argument` for `$` and `$sync` (fixture `entry-arguments`), and `$store is only limited to identifiers.` (fixture `store-pattern`).

Kept as 0.5 rules, because the 0.4 rule breaks another rule or is not sound:

13. Inside a running `$sync` body, a write defers the `$sync` bodies it queues until the outermost body returns (decision 6). 0.4 ran them at once, inside the write. A re-entrant drain breaks the total order, can dispose a child scope that is still on the stack, and with (c) 1 would run a body inside its own run. One effect: a body that writes a value and then writes the old value back still runs the other bodies once, where 0.4 ran them twice.
14. A setup, run or composable that throws is disposed (decision 16). 0.4 left the instance alive with its subscriptions and no way to dispose it. That is a leak, not an equal choice.
15. A write to a `const` is a compile error. 0.4 turned top-level `const` into `let`, so the write worked. It is invalid JS, and TypeScript rejects it.
16. Reads inside a nested `$$` or `$composable` do not count for the entry or memo around it, and such a call is never a memo (decisions 15 and 20). In 0.4 the outer entry ran again, and for a nested `$$` it made a new root on each change that nothing disposed. This also matches gate decision 1 for nested entries.

## Still open

- Size: the sketch is 1481 B gzip, 19 B under the cap. `runtime-v2` does the size pass toward 1.2 kB (follow-up decision 7).
- The loop guard counts entry runs, so one write that runs more than 10000 entries throws. Counting rounds, as brumate does, would avoid that, but silmaril has no rounds.
- The compiler-api contract (PR #9) still describes the 0.4 analysis model. It needs the slot, entry, reads and graph rules of this contract before codegen starts.
