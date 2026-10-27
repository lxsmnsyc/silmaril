# Getting started

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

## Requirements

Due to the compile-time nature of this library, it requires the use of [Babel](https://babeljs.io/). `silmaril` provides a Babel plugin under `silmaril/babel`.

`silmaril` requires Node.js `^22.18.0 || >=24.11.0` and is published as ESM only.

The compiler runs at build time, so add it to your build. [Bundler setup](./bundler-setup.md) shows how.

## Next

- [Bundler setup](./bundler-setup.md) adds the compiler to your build.
- [Basic reactivity](./basic-reactivity.md) describes `$$` and `$`.
