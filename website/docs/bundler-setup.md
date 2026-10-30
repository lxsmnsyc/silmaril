# Bundler setup

`silmaril/unplugin` runs the compiler in your bundler. It is an [unplugin](https://unplugin.unjs.io/), so it works with Vite, Rollup, Rolldown, esbuild, webpack, Rspack, Rsbuild, Farm and Bun. For a tool it does not cover, call `silmaril/compiler` yourself (see [Compiler in the browser](#compiler-in-the-browser) and the [API reference](./api.md)).

## Vite

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

This `include` skips `.js` files. Leave `filter` out to compile every script file.

## Rollup

```js
// rollup.config.js
import silmaril from 'silmaril/unplugin';

export default {
  input: 'src/main.js',
  output: { dir: 'dist', format: 'es' },
  plugins: [silmaril.rollup()],
};
```

Rollup does not read TypeScript or JSX. Compiled output keeps the syntax of the source. Add a plugin for that syntax (for example `@rollup/plugin-typescript`). It works before or after `silmaril.rollup()`. Add a resolver such as `@rollup/plugin-node-resolve` for `silmaril` itself.

## Other bundlers

Each bundler has a member on the plugin: `silmaril.rolldown`, `silmaril.esbuild`, `silmaril.webpack`, `silmaril.rspack`, `silmaril.rsbuild`, `silmaril.farm` and `silmaril.bun`. They take the same options.

## Options

`silmaril.<bundler>(options?)` takes one optional object.

```ts
interface SilmarilPluginOptions {
  filter?: {
    include?: FilterPattern;
    exclude?: FilterPattern;
  };
}
```

- `filter.include`: glob patterns or regular expressions for the module ids to compile. Default: every `.js`, `.jsx`, `.ts` and `.tsx` file, including `.mjs`, `.cjs`, `.mts` and `.cts`.
- `filter.exclude`: the same kinds of patterns, for the ids to skip.

`FilterPattern` comes from `unplugin`: a string, a `RegExp`, or an array of them.

The plugin also skips any module whose code does not contain the text `silmaril`. A module that imports no compile-time name comes back unchanged.

### Query strings and sub-modules

The compiler picks the language from the file extension. The plugin drops a query such as `?v=123` first. For an id such as `/a.vue?vue&lang.ts`, it uses the extension that ends the id, so the module compiles as TypeScript with the file name `/a.vue.ts`. Source maps use that name.

## Deprecated packages

`rollup-plugin-silmaril` and `vite-plugin-silmaril` still exist. They call `silmaril/unplugin` and take the same options. Use `silmaril/unplugin` directly.

## Compiler in the browser

Use `silmaril/compiler` in a page to compile code that the user types, as this website does for its samples. In Node.js the compiler works with no setup. In a browser it parses on WebAssembly and needs this setup:

1. Install `@oxc-parser/binding-wasm32-wasip1` at the same version as `oxc-parser`. `silmaril` pins `oxc-parser` to an exact version, and lists the binding as an optional peer dependency with the same version.
2. Pin `@napi-rs/wasm-runtime` to `1.2.5`. Version 1.2.6 does not accept the `@emnapi` versions that the oxc bindings use, and loading fails with `this.bridge.setLastError is not a function`. In pnpm, add an override in `pnpm-workspace.yaml`:

   ```yaml
   overrides:
     '@napi-rs/wasm-runtime': 1.2.5
   ```

3. In Vite, keep both packages out of dependency optimization, and use a build target with top-level await (`es2022` or later):

   ```js
   // vite.config.js
   export default defineConfig({
     optimizeDeps: {
       exclude: ['oxc-parser', '@oxc-parser/binding-wasm32-wasip1'],
     },
     build: { target: 'es2023' },
   });
   ```

4. Await `ready()` before the first `compile`.

   ```js
   import { compile, ready } from 'silmaril/compiler';

   await ready();
   const { code } = compile(source, { filename: 'sample.js' });
   ```

No cross-origin isolation headers are needed.

`compile` only rewrites the module. To run the result in a page, point its `silmaril` imports at the runtime. The `website/src/live/run.ts` file in the repository does this for the samples.
