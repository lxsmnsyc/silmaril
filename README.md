# silmaril

> Compile-time reactivity for JS

Documentation: the website lives in [`website`](https://github.com/lxsmnsyc/silmaril/tree/main/website). Its address goes here once the site is deployed.

[![NPM](https://img.shields.io/npm/v/silmaril.svg)](https://www.npmjs.com/package/silmaril) [![Open in CodeSandbox](https://img.shields.io/badge/Open%20in-CodeSandbox-blue?style=flat-square&logo=codesandbox)](https://codesandbox.io/s/github/LXSMNSYC/silmaril/tree/main/examples/demo)

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

`silmaril` works at compile time, so your code must go through its compiler. `silmaril/compiler` is the compiler, built on [oxc-parser](https://oxc.rs/) and [magic-string](https://github.com/Rich-Harris/magic-string). `silmaril/unplugin` runs it in your bundler. The runtime (`silmaril`, `silmaril/store` and `silmaril/solid`) has no dependencies.

`silmaril` requires Node.js `^22.18.0 || >=24.11.0` and is published as ESM only.

### Bundler plugin

`silmaril/unplugin` provides the compiler as an [unplugin](https://unplugin.unjs.io/), so it works with Vite, Rollup, Rolldown, esbuild, webpack, Rspack, Rsbuild, Farm and Bun.

```js
// vite.config.js
import { defineConfig } from 'vite';
import silmaril from 'silmaril/unplugin';

export default defineConfig({
  plugins: [
    silmaril.vite({
      filter: {
        include: 'src/**/*.{ts,tsx}',
      },
    }),
  ],
});
```

Use `silmaril.rollup`, `silmaril.rolldown`, `silmaril.esbuild`, `silmaril.webpack`, `silmaril.rspack`, `silmaril.rsbuild`, `silmaril.farm` or `silmaril.bun` for the other bundlers.

Options:

- `filter.include` and `filter.exclude`: glob patterns or regular expressions for the modules to compile. By default, every `.js`, `.jsx`, `.ts` and `.tsx` file (including `.mjs`, `.cjs`, `.mts` and `.cts`) that contains `silmaril` is compiled.

`rollup-plugin-silmaril` and `vite-plugin-silmaril` are deprecated in favor of `silmaril/unplugin`.

### Compiler

`silmaril/compiler` compiles one module. Use it to write a plugin for a tool that unplugin does not cover.

```js
import { compile, ready, CompileError } from 'silmaril/compiler';

await ready();

try {
  const { code, map } = compile(source, { filename: 'counter.ts' });
} catch (error) {
  if (error instanceof CompileError) {
    // error.loc has the location, error.frame a code frame
  }
}
```

- `filename` picks the language: `.js` and `.jsx` parse as JSX, `.ts` and `.tsx` as TypeScript (`.mjs`, `.cjs`, `.mts` and `.cts` too). It also names the source in the map.
- `sourcemap`: `false` skips the source map. Default `true`.
- A module that imports no compile-time name from `silmaril` comes back unchanged, with `map` set to `null`.
- `ready()` resolves when `compile` can run. Await it before the first `compile` in a browser. There the parser needs `@oxc-parser/binding-wasm32-wasip1`, an optional peer dependency.

## Usage

### Basic reactivity

`$$` defines the reactive boundary in your JS code. A variable declared in `$$` is reactive when it is written after its declaration, reads a reactive variable or binds a store. Variables declared inside loops stay plain. `$` can be used to asynchronously react to variable changes.

Variable changes and reactions are only limited in `$$` (even for nested `$$` calls).

```js
import { $$, $ } from 'silmaril';

$$(() => {
  // Create a "reactive" variable
  let count = 1;

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

`$` tracks the variables read in its call. It also tracks the variables read by a local function that it calls by name.

```js
import { $$, $ } from 'silmaril';

$$(() => {
  // Create a "reactive" variable
  let count = 0;
  let prefix = 'Count';

  function log(current) {
    console.log(`${prefix}: `, current);
  }

  // This tracks `count`, and `prefix` through `log`
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

After its first run, `$` runs again only after a write that changes a tracked variable (compared with `Object.is`). A write of the same value does nothing. Once queued, `$` runs even if a later write puts the old value back.

Reads inside a function imported from another module are not tracked: the compiler sees one module at a time.

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

`$` runs in a microtask after the code that wrote the variables, so updates are batched. Writing multiple times synchronously causes a single asynchronous update. `await tick()` waits until the queued `$` calls have run.

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

### Skipping tracking

`$skip(expr)` compiles to `expr`. The variables read inside it are not tracked, so a change to them does not re-run the effect or the computed variable.

```js
import { $$, $, $skip } from 'silmaril';

$$(() => {
  let a = 0;
  let b = 0;

  // Re-runs when `a` changes, not when `b` changes
  $(console.log(a, $skip(b)));
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
  // Value 0
  // Squared 0
  // Value 100
  // Squared 10000
});
```

#### `$` and `$sync`

Both `$` and `$sync` behave much like `$$`: variables become reactive, `onMount` and `onDestroy` can be used, same goes to other APIs. Each run of the body is disposed before the next run.

A nested `$` or `$sync` tracks its own reads. A read inside it does not make the outer body run again.

```js
import { $$, $, onDestroy } from 'silmaril';

$$(() => {
  let y = 0;
  $(() => {
    let x = 0;

    // This read makes the outer body run again when `y` changes
    console.log('y is', y);

    $(console.log(x + y));

    onDestroy(() => {
      console.log('This will be cleaned up when `y` changes');
    });

    x += 100;
  });

  setTimeout(() => {
    y += 100;
  });
});
```

## SolidJS

`silmaril/solid` connects `silmaril` stores with [SolidJS](https://www.solidjs.com/) signals. It requires `solid-js` to be installed. This replaces the deprecated `solid-silmaril` package.

### `fromSignal`

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

### `fromStore`

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

## Inspirations/Prior Art

- [Svelte](https://svelte.dev/)
- [Malina](https://malinajs.github.io/docs/)
- [`solid-labels`](https://github.com/LXSMNSYC/solid-labels)
- [Vue's Reactivity Transform](https://github.com/vuejs/rfcs/discussions/369)

## Sponsors

![Sponsors](https://github.com/lxsmnsyc/sponsors/blob/main/sponsors.svg?raw=true)

## License

MIT © [lxsmnsyc](https://github.com/lxsmnsyc)
