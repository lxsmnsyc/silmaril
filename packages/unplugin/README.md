# unplugin-silmaril

> Unplugin for [`silmaril`](https://github.com/lxsmnsyc/silmaril)

[![NPM](https://img.shields.io/npm/v/unplugin-silmaril.svg)](https://www.npmjs.com/package/unplugin-silmaril) [![JavaScript Style Guide](https://badgen.net/badge/code%20style/airbnb/ff5a5f?icon=airbnb)](https://github.com/airbnb/javascript)

## Install

```bash
npm install --D unplugin-silmaril
```

```bash
yarn add -D unplugin-silmaril
```

```bash
pnpm add -D unplugin-silmaril
```

## Usage

```js
import silmaril from 'unplugin-silmaril';

///...
export default {
  plugins: [
    silmaril.vite({
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