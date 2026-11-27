# Glossary

The terms these docs use with a specific meaning, in alphabetical order.

- **Boundary.** The code that a `$$` call covers, with its nested `$composable` calls and entry bodies. Reactivity stops at the boundary. See [basic reactivity](./basic-reactivity.md).
- **Compile-time name.** An export of `silmaril` that the compiler removes from the output: `$$`, `$`, `$sync`, `$skip`, `$store`, `$composable`, `onMount` and `onDestroy`. See the [API reference](./api.md#silmaril).
- **Composable.** A function wrapped in `$composable`. It runs in its own scope under the scope of its caller. See [composition](./composition.md).
- **Computed variable.** A variable whose initializer reads a reactive variable. It evaluates again when a variable it reads changes. Also called a memo. See [computed variables](./computed-variables.md).
- **Dispose.** Stop a scope. Its child scopes are disposed first, then its `onDestroy` callbacks and store unsubscribes run. See [lifecycles](./lifecycles.md).
- **Entry.** A piece of code that runs again: a computed variable, a store write-back, a `$sync` body or a `$` body. See [internals](./internals.md#entries-and-phases).
- **Flush.** The microtask in which queued `$` bodies run. `tick()` resolves at its end. See [synchronous tracking](./synchronous-tracking.md).
- **Graph.** The list, for each slot, of the entries that read it. The compiler writes it into the module. See [internals](./internals.md).
- **Local function.** A function declaration, or a `const`, `let` or `var` with a function initializer, declared in the same setup and never written. A call to it by name tracks what it reads. See [limits](./limits.md#functions-the-compiler-cannot-follow).
- **Opaque call.** A call whose reads the compiler cannot see, such as a call to an imported function. See [limits](./limits.md).
- **Reactive variable.** A variable declared directly in a setup that is written after its declaration, reads a reactive variable, or binds a store. See [basic reactivity](./basic-reactivity.md#which-variables-are-reactive).
- **Scope.** The runtime state of one setup or one run of an entry: its slots, its child scopes and its callbacks. See [internals](./internals.md#scopes).
- **Setup.** The function passed to `$$` or `$composable`. A `$$` setup runs once, at the `$$` call. A `$composable` setup runs at each call of the composable.
- **Slot.** The numbered place in a scope where the runtime keeps the value of a reactive variable. See [internals](./internals.md).
- **Store.** An object with `get` and `subscribe`, and optionally `set`, that `$store` binds to a variable. See [stores](./stores.md).
- **Write.** An assignment, an update such as `count += 1`, or a store change. Changing an object in place is not a write.

## Related

- [Introduction](./index.md)
- [Internals](./internals.md)
