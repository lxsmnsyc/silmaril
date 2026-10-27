# Stores

Reactivity is isolated in `$$`, but there are multiple ways to expose it outside `$$` e.g. emulating event emitters, using observables, global state management, etc.

`silmaril/store` provides a simple API for this, and `$store` allows two-way (or one-way) binding for stores.

```js
import { $$, $, $sync, $store } from 'silmaril';
import Store from 'silmaril/store';

// Create a store
const count = new Store(100);

// Subscribe to it
count.subscribe((current) => {
  console.log('Raw Count:', current);
});

$$(() => {
  // Bind the store to a reactive variable
  let current = $store(count);
  // `const` can also be used as an alternative
  // for enforcing one-way binding

  // Tracking the bound variable
  $sync(console.log('Sync Count:', current));
  $(console.log('Async Count:', current));

  // Mutate the variable (also mutates the store)
  current += 100;

  // Logs
  // Sync Count: 100
  // Raw Count: 200
  // Sync Count: 200
  // Async Count: 200
});
```

`$store` can accept any kind of implementation as long as it follows the following interface:

- `subscribe(callback: Function): Function`: accepts a callback and returns a cleanup callback
- `get()`: returns the current state of the store
- `set(state)`: optional, mutates the state of the store.
