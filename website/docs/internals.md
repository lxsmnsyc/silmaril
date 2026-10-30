# Internals

silmaril decides at compile time which code each variable feeds. The compiler writes that graph into the module, and the runtime follows it. This page walks through one setup, then describes slots, entries, the order of runs and the loop guard.

## Step by step

This sample has one written variable, one computed variable and two entries that read:

```js live internals-order.js

```

### 1. The compiler picks slots

Each `$$` and `$composable` setup is a scope. A declaration gets a numbered slot when it is written, reads a reactive value, or binds a store. Others stay plain JS locals.

- `n` is written, so it is slot 0.
- `double` reads `n`, so it is a computed variable (a memo) and slot 1.

### 2. The compiler numbers the entries

An entry is a piece of code that runs again: a computed variable, a `$sync` body or a `$` body. Entries are numbered from 0 in three groups, each in source order. Memos and store write-backs come first, then `$sync` calls, then `$` calls.

- `double` is entry 0.
- The `$sync` call is entry 1.
- The `$` call is entry 2.

Registration still happens in source order, so ids are not registration order.

### 3. The compiler writes the graph

For each slot, the graph lists the entries that read it. Here slot 0 (`n`) is read by entries 0, 1 and 2, and slot 1 (`double`) by entry 1:

```js
const $g0 = [[0, 1, 2], [1]];

$$root($g0, ($s) => {
  $$set($s, 0, 1);
  $$memo($s, 0, 1, () => $$get($s, 0) * 2);

  $$effect($s, 2, () => console.log('$ sees', $$get($s, 0)));
  $$sync($s, 1, () =>
    console.log('$sync sees', $$get($s, 0), 'and', $$get($s, 1)),
  );

  $$set($s, 0, 5);
});
```

- Reads become `$$get(scope, slot)`. Writes become `$$set(scope, slot, value)`.
- The graph is a constant of the module. The runtime never builds it.
- The Compiled tab of any sample on this site shows this output.

### 4. A write queues the readers

`$$set($s, 0, 5)` compares the value with `Object.is`. A different value is stored, and the entries listed for slot 0 are queued: entries 0, 1 and 2. Then the queues drain.

1. Entry 0 runs. `double` becomes 10, which is a write to slot 1. That queues entry 1, which is already queued.
2. Entry 1 runs after the computed variables, with `n` at 5 and `double` at 10.
3. Entry 2 waits for the microtask flush and logs `$ sees 5`.

## Scopes

- `$$root` makes a root scope. A `$$` call compiles to it.
- Each run of a `$` or `$sync` body gets a child scope, and so does each run of a memo. Declarations inside the body live in that scope.
- A call of a `$composable` function makes a composable scope under the running scope.
- A run disposes the child scope of the last run of the same entry before it makes a new one. Disposing runs the `onDestroy` callbacks and unsubscribes stores.

A graph belongs to one scope body. A path in a graph reaches an entry of a nested body in the same setup tree. A path never goes through a composable or a nested root.

## Entries and phases

There are three kinds of entry, in three phases:

| Entry                               | Phase | When it runs                      |
| ----------------------------------- | ----- | --------------------------------- |
| Computed variable, store write-back | memo  | In the write, first.              |
| `$sync` body                        | sync  | In the write, after the memos.    |
| `$` body                            | flush | In a microtask, after the writes. |

A drain runs the memo queue until it is empty, then the `$sync` queue until it is empty. Writes inside a `$sync` body run the memo queue before they return, and the `$sync` bodies they queue wait until the outermost `$sync` body returns.

`$` bodies are never run by a write. The first queued `$` schedules one flush with `queueMicrotask`. `tick()` returns a promise that resolves at the end of the next flush.

## The order of runs

Two queued entries of the same phase run in this order:

1. The entry whose scope has the lower depth runs first.
2. At equal depth, walk both scopes up to their closest common ancestor and compare the ranks of the two branches. The rank of an entry child scope is its entry id.
3. In the same scope, the lower entry id runs first.

Entry ids put memos in declaration order, and declaration order is a topological order. So a memo runs after the memos it reads, and parents run before their children.

When an entry is taken from a queue and an ancestor scope belongs to a queued entry, the entry is dropped. The run of the ancestor disposes its scope, and the new run queues what it needs.

## The loop guard

A write can queue an entry that is running. The entry runs again after it returns, so a body that writes what it reads runs until the value settles.

The outermost drain counts the entries it takes from the memo and `$sync` queues. When the count passes 10,000, each entry taken after that throws `Error('Update loop')` in place of running. The first error is held and thrown when the drain ends, so it reaches the caller of the write. The count resets when the outermost drain ends. See [limits](./limits.md#the-loop-guard) for the `$` flush.

## Errors

- An error thrown by an entry is held. The first held error wins. The other queued entries still run, and the outermost drain throws the error at the end.
- A run that throws disposes its new child scope. The entry stays registered and runs again when what it reads changes.
- A memo that throws keeps its old value.
- A setup that throws is disposed, and the error is thrown again from `$$`.

## Reads

The compiler decides the reads of an entry:

- A read is a reference to a binding with a slot that is not a write target.
- Reads in nested functions count, also when they are never called.
- Reads in nested entries, in `$skip(...)` and in nested `$$` or `$composable` setups do not count.
- A call by name to a local function adds the reads of that function. See [limits](./limits.md) for the calls that are not followed.
- An entry does not read the slots of its own child scope, because running the body again would reset them. If it reads a memo of its child scope, it gets that memo's reads instead.

## Size

The runtime has no dependencies. It is about 1.4 kB gzipped (cap 1.5 kB).
