# vite-plugin-silmaril

> Vite plugin for [`silmaril`](https://github.com/lxsmnsyc/silmaril)

[![NPM](https://img.shields.io/npm/v/vite-plugin-silmaril.svg)](https://www.npmjs.com/package/vite-plugin-silmaril) [![JavaScript Style Guide](https://badgen.net/badge/code%20style/airbnb/ff5a5f?icon=airbnb)](https://github.com/airbnb/javascript)

## Install

```bash
npm install --D vite-plugin-silmaril
```

```bash
yarn add -D vite-plugin-silmaril
```

```bash
pnpm add -D vite-plugin-silmaril
```

## Usage

```js
import silmaril from 'vite-plugin-silmaril';

///...
export default {
  plugins: [
    silmaril({
      filter: {
        include: 'src/**/*.ts',
        exclude: 'node_modules/**/*.{ts,js}',
      },
    })
  ]
}
```

## Sponsors

![Sponsors](https://github.com/lxsmnsyc/sponsors/blob/main/sponsors.svg?raw=true)

## License

MIT © [lxsmnsyc](https://github.com/lxsmnsyc)
