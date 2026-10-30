# Limits

The compiler follows reads in the setup it compiles. Some reads are out of its reach. This page lists them, so you know when a change does not run your code.

## The compiler reads one module

silmaril decides what a write runs when the module compiles. It sees only reads in the same setup tree. A read it cannot see is not tracked, and a change to that value runs nothing.

### Functions the compiler cannot follow

A call tracks the reads of the function when the function is local. A local function is a function declaration, or a `let`, `const` or `var` with a function or arrow initializer, declared inside the same setup. The binding must never be written and must have no slot.

Every other call is opaque, and the reads inside it are not tracked:

- Functions imported from another module.
- Functions declared outside the setup, such as at module level or in another setup.
- Parameters, as in `param()`.
- Member calls, as in `obj.read()`.
- Calls through a namespace import.
- A binding that is written, as in `let f = () => a; f = other`. It has a slot, so the call reads `f` and not what `f` reads.

To track a value, pass it in as an argument or read it in the setup:

```js
import { read } from './other.js';

$$(() => {
  let count = 0;

  // Not tracked: read() reads `count` in another module.
  $sync(console.log(read()));

  // Tracked: the argument is read in the setup.
  $sync(console.log(read(count)));
});
```

A function initializer that reads a reactive value is a computed variable, not an opaque helper. `const handler = () => count` has a slot, and a call to it reads that slot.

Reads inside nested plain functions are followed, as in `$sync(() => [1].map(() => a))`. Reads inside `$skip(...)`, nested entries and nested setups are not part of the outer entry.

### Mutation in place

Mutating an object in place is not a write. A reactive variable changes only when you assign it.

```js live limits-in-place.js

```

To react to a change, assign a new value: `user = { ...user, name: 'Grace' }`.

### Defaults in declaration patterns

A read in a default of a declaration pattern does not make a computed variable. Only the initializer counts. In this sample `b` reads `a` once, when the line runs, and does not follow `a`:

```js live limits-pattern-default.js

```

Read the variable in the initializer to track it, as in `const b = a`.

### `typeof` queries

`type T = typeof n` keeps naming the binding `n`, also when `n` has a slot. A type is erased at compile time, so it is not a read and adds no edge to the graph.

## The loop guard

An entry that writes what it reads runs again until the value settles. A cycle that settles is not an error:

```js live limits-settled-loop.js

```

A cycle that never settles would run forever. One write that reaches more than 10,000 entries in one drain throws `Error('Update loop')`. The error reaches the caller of the write, or of `$$` for a setup. The root is disposed when its setup throws.

```js live limits-update-loop.js

```

Details:

- The count covers the computed variables and `$sync` bodies that one outermost write runs, including the ones inside it. It starts at 0 for the next write.
- After the limit, every entry that is taken throws instead of running. The first error is thrown and the rest of the queue is dropped.
- The `$` flush has its own count of 10,000. It counts a `$` body that ran before. A first run does not count, so a flush can start any number of new `$` bodies. The error is thrown from the microtask, so the host reports it.
- Writing the value a variable already holds queues nothing, so a two-way binding between two variables settles.

## Other limits

- A write to a variable that was declared in a loop or in a nested function is a write to a plain local. It runs nothing.
- Without the compiler, `$$` and `$composable` run with no reactivity. A namespace or default import of `silmaril` is not compiled either.
- A read of a reactive variable before its declaration returns `undefined`.
- Each computed variable runs at most once per write when every computed variable reads only variables declared before it and none writes a variable.
