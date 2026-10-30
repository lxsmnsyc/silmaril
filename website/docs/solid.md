# SolidJS

`silmaril/solid` connects `silmaril` stores with [SolidJS](https://www.solidjs.com/) signals. It requires `solid-js` to be installed. This replaces the deprecated `solid-silmaril` package.

## `fromSignal`

Turns a Solid signal into a store that `$store` can bind.

```js
import { createSignal, createEffect } from 'solid-js';
import { fromSignal } from 'silmaril/solid';
import { $$, $sync, $store } from 'silmaril';

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
```

## `fromStore`

Turns a store into a Solid signal.

```js
import { createEffect } from 'solid-js';
import { fromStore } from 'silmaril/solid';
import { $$, $sync, $store } from 'silmaril';
import Store from 'silmaril/store';

const countStore = new Store(0);

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
```
