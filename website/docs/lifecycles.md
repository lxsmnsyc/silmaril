# Lifecycles

## `onMount`

`onMount` can be used to detect once `$$` has finished the setup.

```js
import { $$, onMount } from 'silmaril';

$$(() => {
  onMount(() => {
    console.log('Mounted!');
  });
  console.log('Not mounted yet!');
});
```

`onMount` can also be used in `$`, `$sync`, `$composable` and computed variables.

## `onDestroy`

`$$` returns a callback that allows disposing the reactive boundary. You can use `onDestroy` to detect when this happens.

```js
import { $$, onDestroy } from 'silmaril';

const stop = $$(() => {
  onDestroy(() => {
    console.log('Destroyed!');
  });
});

// ...
stop();
```

`onDestroy` can also be used in `$`, `$sync`, `$composable` and computed variables.
