# silmaril

> Compile-time reactivity for JS

[![NPM](https://img.shields.io/npm/v/silmaril.svg)](https://www.npmjs.com/package/silmaril)

Write plain `let` variables and assignments. The compiler finds which code reads each variable, so a write runs only that code. The runtime has no dependencies and ships under 1.5 kB gzipped.

## Install

```bash
npm install silmaril
```

Add the compiler to your bundler. `silmaril/unplugin` works with Vite, Rollup, Rolldown, esbuild, webpack, Rspack, Rsbuild, Farm and Bun.

```js
// vite.config.js
import { defineConfig } from 'vite';
import silmaril from 'silmaril/unplugin';

export default defineConfig({
  plugins: [silmaril.vite()],
});
```

`silmaril` requires Node.js `^22.18.0 || >=24.11.0` and is published as ESM only.

## Example

```js
import { $$, $ } from 'silmaril';

$$(() => {
  let count = 0;

  $(console.log('Count:', count));

  count += 1;
  count *= 100;
});
// Logs `Count: 100` once, after the setup.
```

`$$` defines the reactive boundary. `$` runs again after a write changes a variable it reads.

## Documentation

- [Getting started](https://silmaril-docs.vercel.app/docs/getting-started)
- [Bundler setup](https://silmaril-docs.vercel.app/docs/bundler-setup)
- [API reference](https://silmaril-docs.vercel.app/docs/api)
- [Migrating from 0.4](https://silmaril-docs.vercel.app/docs/migration)
- [Changelog](https://github.com/lxsmnsyc/silmaril/blob/main/packages/silmaril/CHANGELOG.md)

The source of the website is in [`website`](https://github.com/lxsmnsyc/silmaril/tree/main/website).

## Sponsors

![Sponsors](https://github.com/lxsmnsyc/sponsors/blob/main/sponsors.svg?raw=true)

## License

MIT © [lxsmnsyc](https://github.com/lxsmnsyc)
