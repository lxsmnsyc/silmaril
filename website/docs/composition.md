# Composition

## `$composable`

`$composable(setup)` wraps a function so that it can use reactive variables, `$`, `$sync`, `$store`, `onMount` and `onDestroy`. Call it from a `$$`, another `$composable`, or the body of a `$` or `$sync`.

```js live composition-squared.js

```

The composable runs in its own scope under the scope of its caller.

- It mounts at the place of its call and is disposed with its caller. Its `onDestroy` callbacks run at the place of the call among those of the caller.
- It returns whatever the setup returns.
- Arguments are passed as values. A composable cannot track a variable of its caller, so pass a store as the sample does.
- Called while no scope is running, it throws `Unexpected missing reactive boundary.` This includes a call after an `await` in an async body.
- If the setup throws, the scope is disposed and the error is thrown again from the call.

Called through a namespace import (`import * as s from 'silmaril'`), `$$` and `$composable` still run, but without reactivity.

### Order across scopes

A value that moves from one scope to another through a store is a new write in the second scope. The scopes run in a fixed order. A body that reads values from both sides can see a new value next to an old one, then run again.

## `$` and `$sync` as scopes

The body of `$` and `$sync` is a scope. Variables declared in it are reactive, and `onMount`, `onDestroy` and `$store` work there.

Each run disposes the scope of the last run and makes a new one. Variables declared in the body start again, and `onDestroy` callbacks of the last run fire first.

```js live composition-nested.js

```

The outer `$` reads `y`, so a change to `y` runs it again, and it destroys the inner scope first. The inner `$` tracks its own reads. A read inside it does not make the outer body run again.

Rules for nested entries:

- A parent runs before its children.
- When a parent and its child are both queued, only the parent runs. Its run disposes the child scope.
- A `$` or `$sync` must be called directly in a setup body. It cannot be in a loop, a nested function or a computed variable. See [basic reactivity](./basic-reactivity.md).
