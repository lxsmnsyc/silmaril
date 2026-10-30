# Getting started

This page installs `silmaril` in a Vite project and runs a first example.

## Requirements

- Node.js `^22.18.0 || >=24.11.0`.
- A bundler. This page uses Vite. [Bundler setup](./bundler-setup.md) covers the others.

`silmaril` is published as ESM only.

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

`silmaril` compiles your code at build time with `silmaril/compiler`, which uses [oxc-parser](https://oxc.rs/) and [magic-string](https://github.com/Rich-Harris/magic-string). Both install with `silmaril`. There is no Babel step. The runtime (`silmaril`, `silmaril/store` and `silmaril/solid`) has no dependencies.

## Add the plugin

Add `silmaril/unplugin` to `vite.config.js`.

```js
// vite.config.js
import { defineConfig } from 'vite';
import silmaril from 'silmaril/unplugin';

export default defineConfig({
  plugins: [silmaril.vite()],
});
```

The plugin compiles every `.js`, `.jsx`, `.ts` and `.tsx` module that imports from `silmaril`. Other modules are not touched.

## First example

Put this in `src/main.js`.

```js live counter.js

```

`$$` is the reactive boundary. `count` is reactive because the code writes it after its declaration. `$` runs again when a variable it reads changes. The edits to `count` are batched, so the log runs once, after the code that wrote it.

Start the dev server with `npx vite`. The console shows `Count: 100`.

If a module that imports `silmaril` is not compiled, `$` throws `$ is meant to be compile-time only.` when it runs. Check that the plugin includes the file. See the `filter` option in [Bundler setup](./bundler-setup.md).

## Next

- [Bundler setup](./bundler-setup.md) covers Rollup, the other bundlers, every plugin option and the compiler in the browser.
- [Basic reactivity](./basic-reactivity.md) describes `$$` and `$`.
- [API reference](./api.md) lists every export.
