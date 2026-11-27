# Errors

Every error that `silmaril` throws, with its cause and its fix. Compile errors come first, in the order the compiler checks them, then runtime errors.

`<name>` stands for the local name of the import, such as `$` or `$sync`. A compile error is a [`CompileError`](./api.md#compileerror). Its message ends with the location as `(line:column)`, and its `frame` shows the source line.

## Compile errors

### Syntax error

The parser rejects the module, for example with `Unexpected token (1:50)`. The message comes from oxc.

Fix the syntax. The compiler picks the language from the file extension, so TypeScript in a `.js` file fails here. See [`CompileOptions`](./api.md#compileoptions).

### Can only be called

```txt
<name> can only be called.
```

A compile-time name is used as a value, such as `const run = $;` or `[$$].map(...)`. The compiler removes these names, so a reference that is not a call has nothing to point at.

Call the name directly: `$(expression)`.

### One argument

```txt
<name> takes exactly one argument.
<name> can only accept a single argument
```

`$skip`, `$store`, `$`, `$sync`, `onMount` or `onDestroy` gets no argument, more than one, or a spread.

Pass one argument. To track two values in one `$`, pass one expression that reads both: `$(console.log(a, b))`.

### Must be called with a function

```txt
<name> must be called with a function.
```

`$$` or `$composable` gets an argument that is not an arrow function or a function expression, such as a variable that holds a function.

Write the function inline: `$$(() => { ... })`.

### Must be used inside a setup

```txt
<name> must be used inside $$ or $composable.
```

`$skip`, `onMount` or `onDestroy` is called outside every `$$` and `$composable`, such as at module level.

Move the call into a setup, or wrap the function that holds it in [`$composable`](./composition.md).

### Must be called directly in a setup body

```txt
<name> must be called directly in a setup body.
```

`$` or `$sync` is called inside a nested function, a class member, a computed variable or the argument of another `$` or `$sync`.

Move the call to the body of the `$$`, `$composable`, `$` or `$sync` that should own it. To run reactive code from a helper function, make the helper a `$composable`.

### Inside a loop

```txt
<name> cannot be called inside a loop.
```

`$` or `$sync` is called inside a `for`, `while` or `do` loop of a setup. One entry cannot run once for each iteration.

Move the call out of the loop and read the whole list in it: `$(items.forEach(render))`.

### Store must initialize a variable

```txt
$store must initialize a variable of a setup body.
```

`$store(...)` is not the whole initializer of a variable declared in a setup body. It is in an expression, at module level, or inside a loop.

Bind the store on its own line: `const value = $store(store);`. See [stores](./stores.md#rules).

### Store needs an identifier

```txt
$store is only limited to identifiers.
```

`$store(...)` initializes a pattern, such as `const { a } = $store(store)`.

Bind the store to one name, then destructure in a computed variable: `const state = $store(store); const { a } = state;`.

### Skip comment

```txt
The /* $skip */ comment is not supported. Use $skip(expression).
```

A setup holds the `/* $skip */` comment from silmaril 0.4.

Wrap the expression instead: `$skip(value)`. See [basic reactivity](./basic-reactivity.md#skip).

### Assign to a constant

```txt
Cannot assign to a constant.
```

The code writes a reactive variable declared with `const`. silmaril 0.4 turned such a `const` into `let`. 0.5 does not.

Declare the variable with `let`.

### JSX tag

```txt
A reactive variable cannot be used as a JSX tag.
```

A reactive variable is the tag of a JSX element, such as `<Tag />`. The compiler replaces reads of the variable with calls, and a call cannot be a tag.

Copy the value into a plain local inside the code that renders, or pick the component with a condition.

## Runtime errors

### Compile-time only

```txt
<name> is meant to be compile-time only.
```

A module that uses `$`, `$sync`, `$skip`, `$store`, `onMount` or `onDestroy` ran without the compiler.

Check that the plugin compiles the file. See the `filter` option in [bundler setup](./bundler-setup.md#options). A namespace or default import of `silmaril` is not compiled either. Use named imports.

### Update loop

```txt
Update loop
```

One write runs more than 10,000 computed variables and `$sync` bodies, or one `$` flush runs more than 10,000 `$` bodies that ran before. Code writes a value it reads, and the value never settles.

Find the entry that writes what it reads and make it stop writing once the value is stable, or move the write out of it. See [the loop guard](./limits.md#the-loop-guard).

### Missing reactive boundary

```txt
Unexpected missing reactive boundary.
```

A `$composable` function is called while no setup or entry is running. That includes a call after an `await` in an async body, and a call from an event handler.

Call the composable synchronously from a `$$`, another `$composable`, or the body of a `$` or `$sync`. See [composition](./composition.md).

### Store without set

A `let` bound to a store that has no `set` method throws a `TypeError` when the binding is registered, such as `store.set is not a function`.

Declare the variable with `const` for a one-way binding, or give the store a `set` method. See [stores](./stores.md#one-way-and-two-way).

## Related

- [Troubleshooting](./troubleshooting.md) lists what to check when code does not run.
- [Limits](./limits.md) lists the reads the compiler cannot see.
- [API reference](./api.md) lists every export.
