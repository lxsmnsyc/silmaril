# silmaril

> Compile-time reactivity for JS

[![NPM](https://img.shields.io/npm/v/silmaril.svg)](https://www.npmjs.com/package/silmaril) [![JavaScript Style Guide](https://badgen.net/badge/code%20style/airbnb/ff5a5f?icon=airbnb)](https://github.com/airbnb/javascript)

## Install

```bash
npm install --save silmaril
```

```bash
yarn add silmaril
```

```bash
pnpm add silmaril
```

## Features

- Compile-time reactivity
- Minimal reactive runtime
- Auto-memoization
- Stores

## Requirement

Due to the compile-time nature of this library, it requires the use of [Babel](https://babeljs.io/). `silmaril` provides a Babel plugin under `silmaril/babel`.

## Usage

### Basic reactivity

`$$` defines the reactive boundary in your JS code. Any top-level variables (function-scoped) declared in `$$` will be treated as "reactive" as possible. `$` can be used to asynchronously react to variable changes.

Variable changes and reactions are only limited in `$$` (even for nested `$$` calls).

```js
import { $$, $ } from 'silmaril';

$$(() => {
  // Create a "reactive" variable
  let count = 0;

  // Log count for changes
  $(console.log('Count: ', count));


  function multiply() {
    // Update count
    count *= 100;
  }

  multiply();
  // After some time, this code logs `Count: 100`.
});
```

`$` will know which variables to track with, but it can only know if the variable is accessed in that same call.

```js
import { $$, $ } from 'silmaril';

$$(() => {
  // Create a "reactive" variable
  let count = 0;
  let prefix = 'Count';

  function log(current) {
    // `prefix` is not tracked
    console.log(`${prefix}: `, current);
  }

  // This only tracks `count`
  $(log(count));
});
```

`$` can also accept a function expression, and has the same tracking capabilities.

```js
$(() => {
  // This tracks `count`
  console.log('Count:', count);
});
```

`$` will only run if the tracked variables have actually changed (except for the first run), which means that it has some "auto-memoization".

### Computed variables

If a reactive variable references another, the variable becomes computed, which means that it will re-evaluate everytime the referenced variables changes.

```js
import { $$, $ } from 'silmaril';

$$(() => {
  // Create a "reactive" variable
  let count = 0;

  // Create a "reactive" const variable.
  const message = `Count: ${count}`;

  // This only tracks `message`
  $(console.log(message));

  count = 100; // Logs 'Count: 100'
});
```

Updates on computed variables are synchronous.

```js
import { $$ } from 'silmaril';

$$(() => {
  let count = 0;
  const message = `Count: ${count}`;
  count = 100; // message = Count: 100
  count = 200; // message = Count: 200
});
```

Computed variables are also writable if declared with `let`.

```js
import { $$, $sync } from 'silmaril';

$$(() => {
  let count = 0;
  let message = `Count: ${count}`;
  $sync(console.log('Log', message)); // Log Count: 0
  count = 100; // Log Count: 100
  message = 'Hello World'; // Log Hello World
  count = 200; // Log Count: 200
});
```

### Lifecycles

#### `onMount`

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

#### `onDestroy`

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

### Synchronous tracking

`$` is deferred by a timeout schedule which means that `$` asynchronously reacts on variable updates, this is so that updates on variables are batched by default (writing multiple times synchronously will only cause a single asynchronous update).

`$sync` provides synchronous tracking.

```js
import { $$, $, $sync } from 'silmaril';

$$(() => {
  // Create a "reactive" variable
  let count = 0;

  // Create a "reactive" const variable.
  const message = `Count: ${count}`;

  $sync(console.log('Sync', message)); // Logs "Sync Count: 0"
  $(console.log('Async', message));

  count = 100; // Logs "Sync Count: 100"
  count = 200; // Logs "Sync Count: 200"

  // After some time the code ends, logs "Async Count: 200"
});
```

### Stores

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

### Composition

#### `$composable`

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

#### `$` and `$sync`

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

## Bindings

- [SolidJS](https://github.com/lxsmnsyc/silmaril/tree/main/packages/solid)
- [Rollup](https://github.com/lxsmnsyc/silmaril/tree/main/packages/rollup)
- [Vite](https://github.com/lxsmnsyc/silmaril/tree/main/packages/vite)

## Inspirations/Prior Art

- [Svelte](https://svelte.dev/)
- [Malina](https://malinajs.github.io/docs/)
- [`solid-labels`](https://github.com/LXSMNSYC/solid-labels)
- [Vue's Reactivity Transform](https://github.com/vuejs/rfcs/discussions/369)

## License

MIT © [lxsmnsyc](https://github.com/lxsmnsyc)
