# Computed variables

A variable whose initializer reads a reactive variable is computed. It evaluates again each time a variable it reads changes.

```js live computed-variables-message.js

```

`message` is computed because it reads `count`. `$` tracks `message`, so the write to `count` runs it.

## Updates are synchronous

The compiler records which computed variables read each variable. A write updates them before it returns. Code after the write reads the new values.

```js
import { $$ } from 'silmaril';

$$(() => {
  let count = 0;
  const message = `Count: ${count}`;
  count = 100; // message is now 'Count: 100'
  count = 200; // message is now 'Count: 200'
});
```

Computed variables run in declaration order. When every computed variable reads only variables declared before it, and no computed variable writes a variable, each runs at most once per write.

## Writable computed variables

A computed variable declared with `let` can also be written. The next change to a variable it reads replaces the value.

```js live computed-variables-writable.js

```

## Declaration forms

- Destructuring declarations compute all their names together: `const { width, height } = size;`.
- A function or arrow initializer that reads a reactive variable is computed. Its value is a new function each time that variable changes.
- A class expression is never computed, even if the class reads a reactive variable.
- Only the initializer counts. A reactive variable read in a default value of a declaration pattern does not make the declaration computed.
- A computed variable can write other reactive variables. The write runs in the same pass as the write that caused it.
- If the initializer throws, the variable keeps its old value and the error reaches the caller of the write.

## Limits

- A computed variable reads reactive variables through the code it contains and through local functions it calls by name. A function imported from another module is opaque. See [basic reactivity](./basic-reactivity.md).
- Mutating an object in place does not update the variables that read it.
