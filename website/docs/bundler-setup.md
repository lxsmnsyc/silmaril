# Bundler setup

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
- `babel`: extra [Babel options](https://babeljs.io/docs/options) passed to the transform.

`rollup-plugin-silmaril` and `vite-plugin-silmaril` are deprecated in favor of `silmaril/unplugin`.
