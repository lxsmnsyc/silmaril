# silmaril

Compile-time reactivity for plain JS and TS.

`$$` defines a reactive boundary. A variable declared inside it is reactive when it is written, reads another reactive variable or binds a store. `$` reacts when such a variable changes. The compiler works out which code reads which variable, so a write runs only the code that reads the written variable.

```js live index-overview.js

```

## Features

- Compile-time reactivity. `silmaril/compiler` finds the reactive variables and the code that reads them.
- Static reactive graph. A write runs only the code that reads the written variable.
- Minimal runtime. `silmaril` has no dependencies and ships less than 1.5 kB gzipped.
- Auto-memoization. A computed variable runs again only when a variable it reads changes.
- Stores. `$store` binds any store with `get` and `subscribe` to a variable.

## Where to go next

- [Getting started](./getting-started.md) installs the package and lists the requirements.
- [Bundler setup](./bundler-setup.md) adds the compiler to Vite, Rollup, webpack and others.
- [Basic reactivity](./basic-reactivity.md) starts the guide. [Computed variables](./computed-variables.md), [synchronous tracking](./synchronous-tracking.md), [lifecycles](./lifecycles.md) and [composition](./composition.md) follow it.
- [Stores](./stores.md) and [SolidJS](./solid.md) connect reactive code with the rest of an app.

## Inspirations and prior art

- [Svelte](https://svelte.dev/)
- [Malina](https://malinajs.github.io/docs/)
- [`solid-labels`](https://github.com/LXSMNSYC/solid-labels)
- [Vue's Reactivity Transform](https://github.com/vuejs/rfcs/discussions/369)

## Sponsors

![Sponsors](https://github.com/lxsmnsyc/sponsors/blob/main/sponsors.svg?raw=true)

## License

MIT, by [lxsmnsyc](https://github.com/lxsmnsyc). The source is on [GitHub](https://github.com/lxsmnsyc/silmaril).
