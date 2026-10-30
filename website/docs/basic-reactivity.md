# Basic reactivity

`$$` defines the reactive boundary. The function it takes is the setup. It runs at once, and `$$` returns a function that disposes the boundary.

`$` runs a reaction. It runs once after the setup, then again after a write changes a variable it reads.

```js live basic-reactivity-count.js

```

The sample logs `Count: 1`, then `Count: 100`. The write waits for a timer, so it comes after the first run of `$`. A write made in the setup itself would come before that run, and `$` would log once. `$` runs in a microtask after the code that wrote. See [synchronous tracking](./synchronous-tracking.md).

## Which variables are reactive

A variable declared with `let`, `const` or `var` directly in a setup is reactive when any of these holds.

| Case                                                          | Example                        |
| ------------------------------------------------------------- | ------------------------------ |
| It is a `let` or `var` that is written after its declaration. | `let count = 0; count += 1;`   |
| Its initializer reads a reactive variable.                    | `const double = count * 2;`    |
| It binds a store.                                             | `const value = $store(store);` |

Other rules:

- A write inside a nested function counts, such as `function multiply() { count *= 100; }`.
- A declaration inside an `if`, `try`, `switch` or block of the setup follows the same rules.
- A variable declared inside a loop or a nested function stays a plain variable. One slot cannot hold a value for each iteration.
- A variable that is never written and reads nothing reactive stays a plain variable.
- A read of a reactive variable before its declaration returns `undefined`.
- The boundary also covers nested `$$` calls, `$composable`, and the bodies of `$` and `$sync`.

A write compares the new value with the old one using `Object.is`. A write of the same value does nothing. Changing an object in place, such as `list.push(1)` or `user.name = 'Ada'`, is not a write. Assign a new value to make the change reactive.

## What `$` tracks

`$` tracks the reactive variables that its argument reads. The argument is an expression or a function.

```js
$(console.log('Count:', count));

$(() => {
  console.log('Count:', count);
});
```

It also tracks:

- reads inside a function nested in the argument, even if the function is never called.
- reads inside a local function that the argument calls by name, such as `log(count)`. A local function is a function declaration or a `const`, `let` or `var` with a function initializer, declared in the same setup, and never written.

```js live basic-reactivity-tracking.js

```

The sample logs `Count: 0`, then `Total: 0`. Changing `prefix` runs `$` again, because `log` reads it.

## What `$` does not track

The compiler reads one module at a time. It cannot see inside a function it does not have. A read inside such a function is not tracked. These calls are opaque:

- a function imported from another module.
- a function declared outside the setup.
- a parameter, such as `param()`.
- a method call, such as `store.read()`, and a call through a namespace import.
- a function stored in a variable that is written. The call reads the variable, not what the function reads.

[Limits](./limits.md#functions-the-compiler-cannot-follow) lists every case and how to work around it.

```js
import { $$, $ } from 'silmaril';
import { readPrefix } from './prefix.js';

$$(() => {
  let count = 0;

  // Tracks `count`. A change inside `readPrefix` does not run this.
  $(console.log(readPrefix(), count));
});
```

Pass the value as an argument to make the read visible: `$(log(prefix, count))`.

Reads that are not counted for `$`:

- reads inside a nested `$` or `$sync`. Each nested call tracks its own reads.
- reads inside `$skip(...)`.
- reads inside a nested `$$` or `$composable`.

## `$skip`

`$skip(expression)` compiles to the expression. The reactive variables read inside it are not tracked.

```js
import { $$, $, $skip } from 'silmaril';

$$(() => {
  let a = 0;
  let b = 0;

  // Runs again when `a` changes, not when `b` changes
  $(console.log(a, $skip(b)));
});
```

A write inside `$skip` is still a write. The comment form `/* $skip */` is a compile error.

## Runs that repeat

A `$` that writes a variable it reads runs again after the write, until the value settles.

One write that runs more than 10,000 entries in one pass throws `Update loop`. A cycle that settles is not an error. [Internals](./internals.md#the-loop-guard) explains how the guard counts.

## TypeScript

A reactive variable keeps its type. In a type position, `typeof count` still names the variable, even though the compiler replaces reads of `count` in code.

```ts
import { $$ } from 'silmaril';

$$(() => {
  let count = 0;
  count += 1;

  // `Count` is `number`, and `count` is still the reactive variable
  type Count = typeof count;
  const next: Count = count + 1;
});
```

## Compile errors

- `$` or `$sync` inside a loop of a setup: `$ cannot be called inside a loop.`
- `$` or `$sync` inside a nested function, a computed variable or the argument of another `$`: `$ must be called directly in a setup body.`
- A write to a `const` reactive variable: `Cannot assign to a constant.`
- A reactive variable used as a JSX tag, such as `<Tag />`: `A reactive variable cannot be used as a JSX tag.`
