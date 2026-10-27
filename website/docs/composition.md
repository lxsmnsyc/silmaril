# Composition

## `$composable`

`$composable` allows composing functions that can be used in `$$`, `$sync`, `$`, another `$composable` or computed variables.

```js
import { $$, $sync, $composable, $store, onDestroy } from 'silmaril';
import Store from 'silmaril/store';

// Create a composable
const useSquared = $composable((store) => {
  // Bind the input store to a variable
  const input = $store(store);

  // Create a store
  const squaredStore = new Store(0);

  // Make sure to cleanup the store
  onDestroy(() => squaredStore.destroy());

  // Update the store based on the bound input store
  $sync(squaredStore.set(input ** 2));

  // Return the store
  return squaredStore;
});

$$(() => {
  // Create a store
  const store = new Store(0);

  // Bind it
  let input = $store(store);

  // Track the value of the store
  $sync(console.log('Value', input));

  // Create a "squared" store based on the input store
  // then bind it
  const squared = $store(useSquared(store));

  // Track the squared store
  $sync(console.log('Squared', squared));

  // Update the input store
  input = 100;

  // Logs
  // Count: 0
  // Count: 100
  // Count: 200
});
```

## `$` and `$sync`

Both `$` and `$sync` behave much like `$$`: variables become reactive, `onMount` and `onDestroy` can be used, same goes to other APIs.

```js
import { $$, $, onDestroy } from 'silmaril';

$$(() => {
  let y = 0;
  $(() => {
    let x = 0;

    $(console.log(x + y));

    onDestroy(() => {
      console.log('This will be cleaned up when `y` changes');
    });

    x += 100;
  });
  y += 100;
});
```
