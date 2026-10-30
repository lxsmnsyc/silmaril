# Stores

Reactivity is limited to `$$`. A store passes values across that boundary: to event emitters, observables, global state or another framework.

`silmaril/store` provides a small `Store` class. `$store` binds any store to a variable.

```js live stores-counter.js

```

The variable `current` holds the value of the store.

- A write to `current` calls `store.set`. This applies to `let` only.
- A change of the store writes `current`.
- `$sync` and `$` track `current` like any reactive variable.

## One-way and two-way

| Declaration            | Direction                               |
| ---------------------- | --------------------------------------- |
| `const x = $store(s);` | The store writes the variable.          |
| `let x = $store(s);`   | The store writes the variable and back. |

`let` registers a write-back. It runs once at registration, and again each time the variable changes, also when the change came from the store. It calls `store.set(value)` each time. A store that does not compare values sees the value it sent.

`Store` compares with `Object.is` and notifies only when the value changes.

## The store interface

`$store` takes any object with this shape.

- `get()` returns the current state.
- `subscribe(callback)` accepts a callback and returns a cleanup function.
- `set(state)` is optional. It changes the state. A `let` binding needs it. Without it, registration throws a `TypeError`.

The `Store` class adds `destroy()`, which stops it from notifying.

## Rules

- `$store(...)` must be the whole initializer of a variable declared in a setup body: `$store must initialize a variable of a setup body.`
- The variable must be an identifier. A pattern such as `const { a } = $store(s)` throws `$store is only limited to identifiers.`
- The store expression runs once and is not tracked.
- The subscription ends with the scope.
- An entry body that reads a `$store` variable declared in its own scope does not run again when the store changes. Entries nested in it do.
