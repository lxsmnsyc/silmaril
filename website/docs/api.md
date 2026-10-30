# API reference

Every export of `silmaril`, by subpath. Signatures are copied from the built `.d.ts` files. The package is ESM only.

| Subpath             | Purpose                                                  |
| ------------------- | -------------------------------------------------------- |
| `silmaril`          | Compile-time names and the runtime the compiler targets. |
| `silmaril/store`    | A store class.                                           |
| `silmaril/solid`    | Adapters between stores and Solid signals.               |
| `silmaril/compiler` | The compiler: `compile`, `ready`, `CompileError`.        |
| `silmaril/unplugin` | The compiler as a plugin for bundlers.                   |

## `silmaril`

The compile-time names exist so that your code type-checks. The compiler removes them from the output, so calling one in a module that was not compiled throws. The exceptions are `$$` and `$composable`, described below.

### `$$`

```ts
declare function $$(setup: () => void): () => void;
```

Defines a reactive boundary. A variable declared in `setup` is reactive in three cases. The code writes it after its declaration, it reads a reactive variable, or it binds a store. Returns a function that disposes the boundary and runs the `onDestroy` callbacks.

```js
import { $$, $ } from 'silmaril';

const stop = $$(() => {
  let count = 0;
  $(console.log(count));
  count += 1;
});

stop();
```

In a module that was not compiled, `$$` runs `setup` once with no reactivity.

### `$`

```ts
declare const $: <T>(value: T) => void;
```

Runs its argument in a microtask flush after the code that queued it, and again after a write to a variable it reads. Runs are batched. The argument is an expression or a function expression. It tracks the variables read in the call, and in the local functions the call names. An error thrown in a `$` body is rethrown from a microtask, after the promises of `tick()` resolve. `$` throws `$ is meant to be compile-time only.` in a module that was not compiled.

### `$sync`

```ts
declare const $sync: <T>(value: T) => void;
```

Like `$`, but reruns happen synchronously, inside the write.

### `$skip`

```ts
declare const $skip: <T>(value: T) => T;
```

Compiles to its argument. The variables the argument reads are not tracked.

```js live api-skip.js

```

### `$store`

```ts
declare const $store: <T>(store: Store<T>) => T;
```

Binds a [store](#store) to a variable. Declare it with `let` for two-way binding: a write to the variable calls `store.set`. Declare it with `const` for one-way binding.

```js live api-store.js

```

### `$composable`

```ts
declare function $composable<T extends (...args: any[]) => any>(setup: T): T;
```

Wraps a function so that reactive code in it works when it is called from `$$`, `$`, `$sync`, another `$composable` or a computed variable. Outside a boundary, the compiled function throws `Unexpected missing reactive boundary.` In a module that was not compiled, `$composable` returns `setup` unchanged.

### `onMount`

```ts
declare const onMount: (callback: () => void) => void;
```

Runs `callback` when the enclosing boundary has finished its setup. Works in `$$`, `$`, `$sync`, `$composable` and computed variables.

### `onDestroy`

```ts
declare const onDestroy: (callback: () => void) => void;
```

Runs `callback` when the enclosing boundary is disposed, or before the next run of a `$` or `$sync` body. Works wherever `onMount` works.

### `tick`

```ts
declare function tick(): Promise<void>;
```

Resolves at the end of the next `$` flush, after every queued `$` has run. It never rejects. An error thrown in a `$` body is rethrown from a microtask after `tick()` resolves, so the host reports it. `tick` is a real function and stays in the compiled output.

```js live api-tick.js

```

### `Store`

```ts
export interface Store<T> {
  get(): T;
  set?: (value: T) => void;
  subscribe(callback: () => void): () => void;
}
```

The interface that `$store` accepts, and the contract for a custom store. `get` returns the current value. `set` is optional: without it, the binding is one-way. `subscribe` takes a callback and returns a function that stops the subscription. The runtime ignores any argument to the callback and calls `get()`.

### Runtime functions

These are the functions the compiler emits calls to. Do not call them in your own code. They are public because compiled modules import them from `silmaril`, and their shapes can change in any 0.x release.

```ts
export type Ref = number | readonly number[];
export type Graph = readonly (readonly Ref[] | undefined)[];
export interface Scope {
  /* internal fields */
}

declare function $$root(
  graph: Graph,
  setup: (scope: Scope) => void,
): () => void;
declare function $$composable<A extends unknown[], R>(
  graph: Graph,
  setup: (scope: Scope, ...args: A) => R,
): (...args: A) => R;
declare function $$get(s: Scope, slot: number): any;
declare function $$set<T>(s: Scope, slot: number, value: T): T;
declare function $$update(
  s: Scope,
  slot: number,
  delta: 1 | -1,
  prefix: boolean,
): number;
declare function $$memo(
  s: Scope,
  id: number,
  slot: number,
  compute: (scope: Scope) => unknown,
): void;
declare function $$sync(
  s: Scope,
  id: number,
  body: (scope: Scope) => unknown,
  graph?: Graph,
): void;
declare function $$effect(
  s: Scope,
  id: number,
  body: (scope: Scope) => unknown,
  graph?: Graph,
): void;
declare function $$store<T>(
  s: Scope,
  slot: number,
  store: Store<T>,
  id?: number,
): void;
declare function $$mount(s: Scope, callback: () => void): void;
declare function $$destroy(s: Scope, callback: () => void): void;
```

The compiler turns `$$(...)` into `$$root(...)` and each reactive variable into a slot of a scope. A write calls `$$set` or `$$update`, which runs only the entries that read that slot.

## `silmaril/store`

### `Store` class

```ts
export default class Store<T> {
  constructor(value: T);
  get(): T;
  set(value: T): void;
  subscribe(callback: () => void): () => void;
  destroy(): void;
}
```

A store that holds one value. It follows the `Store` interface, so `$store` accepts it.

- `new Store(value)` creates it with an initial value.
- `get()` returns the value.
- `set(value)` replaces the value and calls each listener with the new value. It does nothing when the value is equal under `Object.is`, or after `destroy()`.
- `subscribe(callback)` adds a listener and returns a function that removes it.
- `destroy()` removes every listener. After it, `set` and `subscribe` do nothing.

```js
import Store from 'silmaril/store';

const store = new Store(0);
const stop = store.subscribe(() => console.log(store.get()));

store.set(1); // Logs 1
stop();
```

## `silmaril/solid`

Needs `solid-js` (optional peer dependency, `^1.7`).

### `fromSignal`

```ts
export interface SignalStore<T> extends Store<T> {
  set(value: T): void;
}

declare function fromSignal<T>([get, set]: Signal<T>): SignalStore<T>;
```

Turns a Solid signal into a store that `$store` can bind. `get` reads without tracking.

### `fromStore`

```ts
declare function fromStore<T>(store: Store<T>): Signal<T>;
```

Turns a store into a Solid signal. Call it where Solid has an owner, because it registers an effect and a cleanup. See [Solid](./solid.md) for examples.

## `silmaril/compiler`

The compiler for one module. `silmaril/unplugin` calls it. It has no `node:` imports, so it runs in a browser (see [Bundler setup](./bundler-setup.md#compiler-in-the-browser)).

### `compile`

```ts
declare function compile(code: string, options: CompileOptions): CompileResult;
```

Compiles `code` and returns the new code and a source map. It is synchronous in Node.js and in the browser. It throws a [`CompileError`](#compileerror) when the code is invalid or uses a compile-time name in an unsupported way. A module that imports no compile-time name from `silmaril` comes back unchanged, with `map` set to `null`.

```js
import { compile, ready } from 'silmaril/compiler';

await ready();

const { code, map } = compile("import { $$ } from 'silmaril';\n$$(() => {});", {
  filename: 'main.js',
});
```

### `CompileOptions`

```ts
export interface CompileOptions {
  filename: string;
  sourcemap?: boolean;
}
```

- `filename`: picks the language and names the source in the map. `.js` and `.jsx` parse as JSX. `.ts` and `.tsx` parse as TypeScript. `.mjs`, `.cjs`, `.mts` and `.cts` also work. `<T>x` is a type assertion only in `.ts`.
- `sourcemap`: `false` skips the source map. Default `true`.

### `CompileResult`

```ts
export interface CompileResult {
  code: string;
  map: SourceMap | null;
}
```

### `SourceMap`

```ts
export interface SourceMap {
  version: number;
  file?: string;
  sources: string[];
  sourcesContent?: (string | null)[];
  names: string[];
  mappings: string;
}
```

A source map v3. `file` and `sources` hold the base name of `filename`. It is assignable to the `SourceMapCompact` type of `unplugin` with no cast.

### `CompileError`

```ts
export declare class CompileError extends Error {
  loc: SourceLocation;
  frame: string;
  constructor(message: string, code: string, offset: number);
}

export interface SourceLocation {
  line: number;
  column: number;
}
```

- `loc.line` is 1-based. `loc.column` is 0-based, in UTF-16 code units.
- `frame` is the source line with a caret under the column.

```js
import { compile, CompileError } from 'silmaril/compiler';

try {
  compile(source, { filename: 'counter.ts' });
} catch (error) {
  if (error instanceof CompileError) {
    console.log(error.loc.line, error.frame);
  }
}
```

### `ready`

```ts
declare function ready(): Promise<void>;
```

Resolves when `compile` can run. Today it resolves at once. Await it before the first `compile` in a browser, so a later parser that loads on demand does not change your code.

## `silmaril/unplugin`

```ts
export interface SilmarilPluginFilter {
  include?: FilterPattern;
  exclude?: FilterPattern;
}

export interface SilmarilPluginOptions {
  filter?: SilmarilPluginFilter;
}

declare const silmaril: UnpluginInstance<
  SilmarilPluginOptions | undefined,
  false
>;
export { silmaril as default };
```

The default export is an unplugin instance. Call `silmaril.vite(options)`, `silmaril.rollup(options)` or the member for another bundler. `FilterPattern` and `UnpluginInstance` come from `unplugin`. The options are in [Bundler setup](./bundler-setup.md#options).

```js
import silmaril from 'silmaril/unplugin';

export default {
  plugins: [silmaril.rollup({ filter: { exclude: 'src/legacy/**' } })],
};
```
