# Migrating from 0.4

silmaril 0.5 compiles with `silmaril/compiler` and runs on a new runtime built on a static reactive graph. A write runs only the code that reads the written variable. The public API keeps its names, so most programs need a new build and no edit. This page lists every change.

Do this first:

1. Update `silmaril` to 0.5.
2. Replace `silmaril/babel` with `silmaril/unplugin` or `compile` from `silmaril/compiler`.
3. Compile your code again. Modules compiled by 0.4 do not run on the 0.5 runtime.
4. Fix the compile errors in [Compile errors](#compile-errors). Each one points at code that did not work in 0.4 or that has no fixed meaning in 0.5.

Each sample below shows the 0.5 result. The 0.4 result is written next to it.

## Removed and added

- `silmaril/babel` is removed. Use `silmaril/unplugin` in a bundler, or `compile` from `silmaril/compiler`. See [bundler setup](./bundler-setup.md).
- The `babel` option of `silmaril/unplugin` is removed. The plugin now calls `silmaril/compiler`.
- The `@babel/core`, `@babel/helper-module-imports` and `@babel/types` dependencies are removed.
- `silmaril/compiler` is new. It exports `compile`, `ready`, `CompileError` and the `CompileOptions`, `CompileResult` and `SourceMap` types. `compile` runs every compile-time check and throws `CompileError` with a location and a code frame. It returns the code with a source map that points back to the original positions.
- `silmaril` depends on `oxc-parser` (an exact version) and `magic-string`. Only `silmaril/compiler` and `silmaril/unplugin` use them. `@oxc-parser/binding-wasm32-wasip1` is an optional peer dependency at the same version as `oxc-parser`. It lets the compiler run in a browser, as it does on this website.
- `tick()` is new. It resolves after the queued `$` bodies have run.
- The helpers that compiled code calls changed. `$$context` and `$$subscribe` are gone. `$$update`, `$$sync`, `$$effect`, `$$mount` and `$$destroy` take new arguments. `$$root`, `$$composable`, `$$get`, `$$set`, `$$memo` and `$$store` are new. You only meet them in compiled output.
- The public names `$$`, `$`, `$sync`, `$skip`, `$store`, `$composable`, `onMount`, `onDestroy` and `Store` keep their API. So do `silmaril/store` and `silmaril/solid`.

### Deprecated packages

The standalone packages are deprecated. Replace them as follows.

| Package                  | Use instead                                              |
| ------------------------ | -------------------------------------------------------- |
| `rollup-plugin-silmaril` | `silmaril/unplugin`, with `silmaril.rollup()`            |
| `vite-plugin-silmaril`   | `silmaril/unplugin`, with `silmaril.vite()`              |
| `solid-silmaril`         | `silmaril/solid`, which has `fromSignal` and `fromStore` |

## Scheduling

### A write runs only its readers

A write runs only the computed variables, `$sync` bodies and `$` bodies that read the written variable. 0.4 ran and compared every `$sync` and computed variable of the instance on every write. The reasons and the graph are in [internals](./internals.md).

In this sample, writing `a` does not run the body that reads `b`:

```js live migration-reads-only.js

```

### Computed variables run before `$sync`

Computed variables run before `$sync` bodies, in declaration order, so a computed variable never reads a stale input. 0.4 ran them in one list in source order, and a computed variable could read another one that had not run yet.

```js live migration-memo-order.js

```

### `$` runs in one microtask flush

`$` runs in one microtask flush for all scopes, in a fixed order: parents before children. 0.4 used one `setTimeout` per instance, so a child's `$` could run before its parent's.

```js live migration-flush-order.js

```

### A queued `$` always runs

A queued `$` runs even if the values it read returned to their old values before the flush. 0.4 compared the values at flush time and skipped the body. Here the value goes to `1` and back to `0`. 0.5 logs a second time, 0.4 logged once.

```js live migration-restored-value.js

```

### Writes inside a `$sync` body

Inside a running `$sync` body, a write runs the `$sync` bodies it queues after the outermost body returns. 0.4 ran them at once, inside the write.

A body that writes a value and then writes the old value back now runs the other bodies once. In this sample, 0.4 logged `a is 1` and then `a is 0`. 0.5 logs `a is 0` once more.

```js live migration-sync-batch.js

```

### Entries that write what they read

An entry that writes what it reads runs again until the value settles. More than 10,000 runs in one flush throw `Error('Update loop')`. See [limits](./limits.md#the-loop-guard).

### Errors do not stop other entries

An error in one computed variable, `$sync` or `$` does not stop the others. The first error is thrown after the flush. In 0.4 it stopped the other `$sync` bodies until the next write.

```js live migration-error-isolation.js

```

### Disposal after an error

A setup, a run or a composable that throws is disposed. 0.4 left it alive with its subscriptions.

## Tracking

### Nested entries track on their own

A `$` or `$sync` body runs again only for reads outside its nested `$` and `$sync` calls. A nested call tracks outer variables on its own. In 0.4, writing a variable read only by the nested call also ran the outer body again, and `outer body: 0` was logged twice.

```js live migration-nested-entry.js

```

### Nested `$$` and `$composable`

Reads inside a nested `$$` or `$composable` do not count for the code around it, and such a call is never a computed variable. In 0.4 the outer entry ran again. For a nested `$$` it also made a new root on each change, and nothing disposed the old one.

### Calls to local functions

A call by name to a local function tracks what the function reads. 0.4 did not track reads inside called functions, so `greeting()` below logged only once. A helper can be declared after the call. The functions the compiler cannot follow are listed in [limits](./limits.md).

```js live migration-local-helper.js

```

### Which declarations are reactive

Only declarations that are written, read a reactive value or bind a store are reactive. Others are plain values. A plain value has no slot and costs nothing at run time. Nothing changes for code that only reads them.

### Declarations in loops

Declarations inside loops are plain locals. `$store` in a loop is a compile error. One slot cannot hold a binding for each iteration.

### Destructuring assignments

A destructuring assignment writes each target on its own, so a `$sync` that reads two targets runs once per changed target. This sample logs three times.

```js live migration-destructuring.js

```

### Values passed through a store

A value passed between scopes through a store is a new write in the receiving scope. The scopes run in a fixed order. A body that reads values from both sides can see a new value next to an old one, and then it runs again.

### `$composable` has its own scope

`$composable` gets its own scope instead of sharing the caller's. Its `onMount` and `onDestroy` callbacks still run at the place of the call. The child scopes of its entries are disposed with the composable, not with the caller's other child scopes.

### Reading before the declaration

A read of a reactive variable before its declaration returns `undefined`. 0.4 threw a `ReferenceError`. Only code that threw in 0.4 sees the change.

```js live migration-read-before-declaration.js

```

## Compile errors

These are compile errors in 0.5. Each shows the 0.4 behavior. A compile error cannot run, so there is no live sample.

| Code                                                          | 0.4                                                                                      |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `$` or `$sync` inside a loop                                  | Compiled.                                                                                |
| The `/* $skip */` comment. Use `$skip(expression)`.           | Skipped tracking for the next expression.                                                |
| A reactive variable used as a JSX tag name                    | Read the plain local, so it never updated.                                               |
| A write to a `const`                                          | Worked. 0.4 turned a top-level `const` into `let`.                                       |
| `$` or `$sync` in a nested function                           | Compiled and threw when it ran.                                                          |
| `$skip`, `onMount` or `onDestroy` outside a setup             | Compiled and threw when it ran.                                                          |
| A compile-time name used other than as a call                 | Compiled and threw when it ran.                                                          |
| `$store` inside a loop                                        | Tracked.                                                                                 |
| `$$` or `$composable` with an argument that is not a function | The message was `<name> argument must be ArrowFunctionExpression or FunctionExpression`. |

The message for a function that is not a function is now `<name> must be called with a function.`

## Unchanged behavior

0.5 keeps these rules from 0.4, so you do not need to change code that uses them:

- `$skip(expression)` skips tracking for its reads.
- A composable called outside a setup throws `Unexpected missing reactive boundary.`
- `$` and `$sync` take a single argument.
- A store binding calls `store.set` when its variable changes, so a `let` bound to a store without `set` throws at setup.
- Declarations in `if`, `try`, `switch` and plain blocks are reactive.
- A function that reads a reactive value is a computed variable, so passing it to `$` or `$sync` tracks it.
