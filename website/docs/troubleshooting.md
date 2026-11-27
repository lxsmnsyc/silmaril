# Troubleshooting

What to check when reactive code does not run, runs too often, or throws. Each entry starts with what you see. For a message, see [errors](./errors.md).

## `$` throws `is meant to be compile-time only`

The module ran without the compiler.

- Check that the plugin is in the bundler config. See [bundler setup](./bundler-setup.md).
- Check that `filter.include` matches the file, and that `filter.exclude` does not.
- Import the names: `import { $$, $ } from 'silmaril'`. A namespace import (`import * as s`) or a default import is not compiled.

## `$` does not run again after a write

Check these causes in order:

1. **The read is in another module.** A call to an imported function is opaque. Pass the value as an argument: `$(log(count))`. See [limits](./limits.md#functions-the-compiler-cannot-follow).
2. **The object changed in place.** `list.push(item)` and `user.name = 'Ada'` are not writes. Assign a new value: `list = [...list, item]`.
3. **The value is the same.** A write compares with `Object.is`, so writing the value the variable holds runs nothing.
4. **The variable is not reactive.** A variable declared inside a loop or a nested function is a plain local. Declare it directly in the setup. See [which variables are reactive](./basic-reactivity.md#which-variables-are-reactive).
5. **The read is inside `$skip`, a nested `$` or a nested `$$`.** Those reads belong to the inner call. See [what `$` tracks](./basic-reactivity.md#what--tracks).
6. **The write happened in another scope.** Reactivity stops at `$$`. Use a [store](./stores.md) to pass values across.

The Compiled tab of a sample on this site shows the output. A read the compiler tracks shows as `$$get(...)`. A plain read keeps its name.

## `$` runs once when you expected several runs

`$` batches writes. All writes before the next microtask cause one run, with the last value. Use `$sync` when code needs each value. See [synchronous tracking](./synchronous-tracking.md).

## The first value is missing from the log

`$` runs for the first time in a microtask after the setup. A write in the setup itself comes before that run, so `$` logs only the final value. Use `$sync` to see the value at the place `$sync` is declared.

## A composable throws `Unexpected missing reactive boundary`

The composable ran while no setup was running.

- Call it synchronously from a `$$`, another `$composable`, or a `$` or `$sync` body.
- Do not call it after an `await`, or from an event handler or a timer. Call it in the setup and keep what it returns.

## `Update loop`

An entry writes a value it reads, and the value never settles. Find the `$sync`, `$` or computed variable that writes, and stop the write once the value is stable. See [the loop guard](./limits.md#the-loop-guard).

## Reading a variable returns `undefined`

The read comes before the declaration of the variable. A reactive variable has no value until its declaration runs. Move the read below the declaration, or into a `$`, which runs after the setup.

## The compiler does not run in the browser

`silmaril/compiler` needs the WebAssembly parser and a pinned `@napi-rs/wasm-runtime`. Follow [compiler in the browser](./bundler-setup.md#compiler-in-the-browser).

## Related

- [Errors](./errors.md) lists every message, its cause and its fix.
- [Limits](./limits.md) lists the reads the compiler cannot see.
- [Glossary](./glossary.md) defines the terms on this page.
