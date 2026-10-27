# rollup-plugin-silmaril

> Rollup plugin for [`silmaril`](https://github.com/lxsmnsyc/silmaril)

> [!WARNING]
> This package is deprecated. Use `silmaril/unplugin` instead. This package now re-exports it and will not get new features.

[![NPM](https://img.shields.io/npm/v/rollup-plugin-silmaril.svg)](https://www.npmjs.com/package/rollup-plugin-silmaril)

## Migration

```diff
- import silmaril from 'rollup-plugin-silmaril';
+ import silmaril from 'silmaril/unplugin';

export default {
  plugins: [
-   silmaril({
+   silmaril.rollup({
      filter: {
        include: 'src/**/*.ts',
      },
    }),
  ],
};
```

The options are the same.

## Sponsors

![Sponsors](https://github.com/lxsmnsyc/sponsors/blob/main/sponsors.svg?raw=true)

## License

MIT © [lxsmnsyc](https://github.com/lxsmnsyc)
