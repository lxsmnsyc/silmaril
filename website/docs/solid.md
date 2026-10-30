# SolidJS

`silmaril/solid` connects `silmaril` stores with [SolidJS](https://www.solidjs.com/) signals. It requires `solid-js` to be installed. This replaces the deprecated `solid-silmaril` package.

Both functions go through the store interface of `$store`: `get`, `set` and `subscribe`. See [stores](./stores.md).

## `fromSignal`

Turns a Solid signal into a store that `$store` can bind.

```js
import { createSignal, createEffect, createRoot } from 'solid-js';
import { fromSignal } from 'silmaril/solid';
import { $$, $sync, $store } from 'silmaril';

createRoot(() => {
  const [count, setCount] = createSignal(0);

  const countStore = fromSignal([count, setCount]);

  createEffect(() => {
    console.log('SolidJS Count:', count());
  });

  $$(() => {
    let counter = $store(countStore);

    $sync(console.log('Silmaril Count:', counter));

    setInterval(() => {
      counter += 1;
    }, 1000);
  });
});
```

The store reads the signal without tracking it. `set` writes the signal. `subscribe` starts a Solid root with an effect that calls the callback when the signal changes, and returns the function that disposes it.

## `fromStore`

Turns a store into a Solid signal.

```js
import { createEffect, createRoot } from 'solid-js';
import { fromStore } from 'silmaril/solid';
import { $$, $sync, $store } from 'silmaril';
import Store from 'silmaril/store';

const countStore = new Store(0);

createRoot(() => {
  const [count, setCount] = fromStore(countStore);

  $$(() => {
    let counter = $store(countStore);

    $sync(console.log('Silmaril Count:', counter));
  });

  createEffect(() => {
    console.log('SolidJS Count:', count());
  });

  setInterval(() => {
    setCount((current) => current + 1);
  }, 1000);
});
```

`fromStore` registers an effect and a cleanup, so call it inside a Solid owner such as a component or `createRoot`. The effect writes the signal to the store when the store has `set`. The cleanup unsubscribes when the owner is disposed.

## What the store does

The samples above need `solid-js`, so they do not run in the page. The next sample uses a hand-written store with the same shape that `fromSignal` returns. A write to the variable reaches the store, and a change from outside reaches the variable.

```js live solid-store.js

```
