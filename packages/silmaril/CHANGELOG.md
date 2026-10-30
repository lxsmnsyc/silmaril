# silmaril

## 0.4.1

### Patch Changes

- [#21](https://github.com/lxsmnsyc/silmaril/pull/21) [`61b30ce`](https://github.com/lxsmnsyc/silmaril/commit/61b30ce6d657a238ced02a1b777a450dbf57de44) Thanks [@lxsmnsyc](https://github.com/lxsmnsyc)! - - `$$(value)` throws when the argument is not an arrow function or a function expression. It compiled without an error before.
  - `$skip(expr)` compiles to `expr` and leaves the variables read inside it out of dependency tracking. It threw at runtime before.

- [#21](https://github.com/lxsmnsyc/silmaril/pull/21) [`e8209b3`](https://github.com/lxsmnsyc/silmaril/commit/e8209b304330da984d6175738f295cfd641c69f1) Thanks [@lxsmnsyc](https://github.com/lxsmnsyc)! - A `$$` nested inside another `$$` compiles with one `_$$context()` instead of two.

## 0.4.0

### Minor Changes

- [#3](https://github.com/lxsmnsyc/silmaril/pull/3) [`b84d148`](https://github.com/lxsmnsyc/silmaril/commit/b84d148527c80c296e1dd195b61c6dde02a4ceee) Thanks [@lxsmnsyc](https://github.com/lxsmnsyc)! - - Add `silmaril/unplugin`, a bundler plugin for Vite, Rollup, Rolldown, esbuild, webpack, Rspack, Rsbuild, Farm and Bun.
  - Add `silmaril/solid` with `fromSignal` and `fromStore`, moved from `solid-silmaril`.
  - The bundler plugin only compiles `.js`, `.jsx`, `.ts` and `.tsx` modules that contain `silmaril` when no `filter.include` is set.
  - `silmaril` is ESM only and requires Node.js `^22.18.0 || >=24.11.0`.
  - The Babel plugin and `silmaril/unplugin` use Babel 8.
  - Compiled output adds the runtime helpers to the existing `silmaril` import instead of adding one import per helper.
