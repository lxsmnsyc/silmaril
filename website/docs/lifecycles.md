# Lifecycles

A boundary has two moments: when its setup has finished, and when it is disposed.

```js live lifecycles-mount.js

```

## `onMount`

`onMount(callback)` runs the callback once the scope has mounted.

- A `$$` mounts after its setup returns.
- The scope of a run of `$` or `$sync` mounts right after the run.
- A `$composable` mounts at the place of its call among the callbacks of the caller. When the caller is already mounted, it mounts right after the call.
- `onMount` in a scope that is already mounted runs the callback at once.
- `onMount` runs the callbacks of a scope in the order they were registered.

## `onDestroy`

`onDestroy(callback)` runs the callback when the scope is disposed. `$$` returns a function that disposes the boundary.

```js
import { $$, onDestroy } from 'silmaril';

const stop = $$(() => {
  onDestroy(() => {
    console.log('Destroyed!');
  });
});

stop();
```

A scope is disposed in these cases:

- `stop()` is called.
- The `$` or `$sync` that owns it runs again. Each run disposes the scope of the last run.
- Its parent is disposed.
- Its setup or run throws.

Disposing runs child scopes first, in the order of their entries. Then the `onDestroy` callbacks and store unsubscribes of the scope run in the order they were registered. A second dispose does nothing. A nested `$$` is not a child. Only the function it returns disposes it.

After disposal, a queued entry of the scope does not run, and a write to its variables stores the value and runs nothing. `onDestroy` in a disposed scope runs the callback at once.

## Where they work

`onMount` and `onDestroy` work in `$$`, `$composable`, `$` and `$sync` bodies, and in computed variables. Outside these, the compiler throws `onMount must be used inside $$ or $composable.`

In a computed variable, the scope belongs to each run. The callbacks of the last run are destroyed when the variable evaluates again. A computed variable can hold a function. Its callbacks belong to the scope that holds the variable, because the function runs when it is called.

An error thrown by a callback reaches the caller of the mount or dispose. The remaining callbacks of that scope do not run.
