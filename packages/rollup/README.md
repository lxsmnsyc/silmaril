# rollup-plugin-silmaril

> Rollup plugin for [`silmaril`](https://github.com/lxsmnsyc/silmaril)

[![NPM](https://img.shields.io/npm/v/rollup-plugin-silmaril.svg)](https://www.npmjs.com/package/rollup-plugin-silmaril) [![JavaScript Style Guide](https://badgen.net/badge/code%20style/airbnb/ff5a5f?icon=airbnb)](https://github.com/airbnb/javascript)

## Install

```bash
npm install --D rollup-plugin-silmaril
```

```bash
yarn add -D rollup-plugin-silmaril
```

```bash
pnpm add -D rollup-plugin-silmaril
```

## Usage

```js
import silmaril from 'rollup-plugin-silmaril';

///...
silmaril({
  filter: {
    include: 'src/**/*.ts',
    exclude: 'node_modules/**/*.{ts,js}',
  },
})
```

## Sponsors

![Sponsors](https://github.com/lxsmnsyc/sponsors/blob/main/sponsors.svg?raw=true)

## License

MIT © [lxsmnsyc](https://github.com/lxsmnsyc)
