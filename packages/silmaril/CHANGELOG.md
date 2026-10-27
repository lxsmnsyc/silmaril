# silmaril

## 0.4.0

### Minor Changes

- [#3](https://github.com/lxsmnsyc/silmaril/pull/3) [`b84d148`](https://github.com/lxsmnsyc/silmaril/commit/b84d148527c80c296e1dd195b61c6dde02a4ceee) Thanks [@lxsmnsyc](https://github.com/lxsmnsyc)! - - Add `silmaril/unplugin`, a bundler plugin for Vite, Rollup, Rolldown, esbuild, webpack, Rspack, Rsbuild, Farm and Bun.
  - Add `silmaril/solid` with `fromSignal` and `fromStore`, moved from `solid-silmaril`.
  - The bundler plugin only compiles `.js`, `.jsx`, `.ts` and `.tsx` modules that contain `silmaril` when no `filter.include` is set.
  - `silmaril` is ESM only and requires Node.js `^22.18.0 || >=24.11.0`.
  - The Babel plugin and `silmaril/unplugin` use Babel 8.
  - Compiled output adds the runtime helpers to the existing `silmaril` import instead of adding one import per helper.
