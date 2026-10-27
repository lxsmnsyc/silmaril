# silmaril

Compile-time reactivity for JS.

silmaril compiles the variables inside a reactive boundary into state that tracks its own readers. You write plain JavaScript, and the compiler wires the updates.

## Features

- Compile-time reactivity
- Minimal reactive runtime
- Auto-memoization
- Stores

## Where to go next

- [Getting started](./getting-started.md) installs the package and lists the requirements.
- [Bundler setup](./bundler-setup.md) adds the compiler to Vite, Rollup, webpack and others.
- [Basic reactivity](./basic-reactivity.md) starts the guide.
- [Stores](./stores.md) and [SolidJS](./solid.md) connect reactive code with the rest of an app.

## Inspirations and prior art

- [Svelte](https://svelte.dev/)
- [Malina](https://malinajs.github.io/docs/)
- [`solid-labels`](https://github.com/LXSMNSYC/solid-labels)
- [Vue's Reactivity Transform](https://github.com/vuejs/rfcs/discussions/369)

## License

MIT, by [lxsmnsyc](https://github.com/lxsmnsyc). The source is on [GitHub](https://github.com/lxsmnsyc/silmaril).
