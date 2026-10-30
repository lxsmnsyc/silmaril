---
'silmaril': minor
---

silmaril 0.5 compiles with `silmaril/compiler` and runs on a new runtime built on a static reactive graph. A write runs only the code that reads the written variable. Recompile your code: modules compiled by 0.4 do not run on the 0.5 runtime.

Removed and added:

- Remove `silmaril/babel`. Use `silmaril/unplugin` in a bundler, or `compile` from `silmaril/compiler`.
- Remove the `babel` option of `silmaril/unplugin`. The plugin now calls `silmaril/compiler`.
- Remove the `@babel/core`, `@babel/helper-module-imports` and `@babel/types` dependencies.
- Add `silmaril/compiler`: `compile`, `ready`, `CompileError` and the `CompileOptions`, `CompileResult` and `SourceMap` types.
- `silmaril` exports the new runtime. Add `tick()`, which resolves after the queued `$` bodies have run. The helpers that compiled code calls changed. `$$context` and `$$subscribe` are gone, and `$$update`, `$$sync`, `$$effect`, `$$mount` and `$$destroy` take new arguments. `$$root`, `$$composable`, `$$get`, `$$set`, `$$memo` and `$$store` are new. The public names (`$$`, `$`, `$sync`, `$skip`, `$store`, `$composable`, `onMount`, `onDestroy`, `Store`), `silmaril/store` and `silmaril/solid` keep their API.

Scheduling:

- A write runs only the computed variables, `$sync` and `$` bodies that read the written variable. 0.4 ran and compared every `$sync` and computed variable of the instance on every write.
- Computed variables run before `$sync` bodies, in declaration order, so a computed variable never reads a stale input. 0.4 ran them in one list in source order.
- `$` runs in one microtask flush for all scopes, in a fixed order (parents before children). 0.4 used one `setTimeout` per instance, so a child's `$` could run before its parent's.
- A queued `$` runs even if the values it read returned to their old values before the flush. 0.4 compared at flush time and skipped it.
- Inside a running `$sync` body, a write runs the `$sync` bodies it queues after the outermost body returns. 0.4 ran them at once, inside the write. A body that writes a value and then writes the old value back now runs the other bodies once, where 0.4 ran them twice.
- An entry that writes what it reads runs again until the value settles. More than 10,000 runs in one flush throw `Error('Update loop')`.
- An error in one computed variable, `$sync` or `$` does not stop the others. The first error is thrown after the flush. In 0.4 it stopped the other `$sync` bodies until the next write.
- A setup, a run or a composable that throws is disposed. 0.4 left it alive with its subscriptions.

Tracking:

- A `$` or `$sync` body runs again only for reads outside its nested `$` and `$sync` calls. A nested call tracks outer variables on its own. In 0.4, writing a variable read only by the nested call also ran the outer body again.
- Reads inside a nested `$$` or `$composable` do not count for the code around it, and such a call is never a computed variable.
- A call by name to a local function tracks what the function reads. 0.4 did not track reads inside called functions. Code that calls a helper now reruns when a variable the helper reads changes. This also works when the helper is declared after the call.
- Only declarations that are written, read a reactive value or bind a store are reactive. Others are plain values.
- Declarations inside loops are plain locals. `$store` in a loop is a compile error.
- A destructuring assignment writes each target on its own, so a `$sync` that reads two targets runs once per changed target.
- A value passed between scopes through a store is a new write in the receiving scope.
- `$composable` gets its own scope instead of sharing the caller's. Its `onMount` and `onDestroy` callbacks still run at the place of the call, but the child scopes of its entries are disposed with the composable.
- A read of a reactive variable before its declaration returns `undefined`. 0.4 threw a `ReferenceError`.

Compile errors:

- `$` and `$sync` inside loops.
- The `/* $skip */` comment. Use `$skip(expression)`.
- A reactive variable used as a JSX tag name.
- A write to a `const`. 0.4 turned top-level `const` into `let`.
- Code that compiled in 0.4 and threw when it ran. That is `$` or `$sync` in a nested function, and `$skip`, `onMount` or `onDestroy` outside a setup. A compile-time name used other than as a call is also an error.
- `$$` or `$composable` with an argument that is not a function says `<name> must be called with a function.` 0.4 said `<name> argument must be ArrowFunctionExpression or FunctionExpression`.
