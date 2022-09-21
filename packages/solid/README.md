# solid-silmaril

> SolidJS bindings for [`silmaril`](https://github.com/lxsmnsyc/silmaril)

[![NPM](https://img.shields.io/npm/v/solid-silmaril.svg)](https://www.npmjs.com/package/solid-silmaril) [![JavaScript Style Guide](https://badgen.net/badge/code%20style/airbnb/ff5a5f?icon=airbnb)](https://github.com/airbnb/javascript)

## Install

```bash
npm install silmaril solid-silmaril
```

```bash
yarn add silmaril solid-silmaril
```

```bash
pnpm add silmaril solid-silmaril
```

## Usage

### `fromSignal`

```js
import { createSignal, createEffect } from 'solid-js';
import { fromSignal } from 'solid-silmaril';
import { $$, $sync, $store } from 'silmaril';

const [count, setCount] = createSignal(0);

const countStore = fromSignal([count, setCount]);

createEffect(() => {
  console.log('SolidJS Count:', count());
});

$$(() => {
  let counter = $store(countStore);

  $sync(console.log('Silmaril Count:', counter));

  setInterval(() => {
    counter += 1;
  }, 1000);
});
```

### `fromStore`

```js
import { createEffect } from 'solid-js';
import { fromStore } from 'solid-silmaril';
import { $$, $sync, $store } from 'silmaril';

const countStore = new Store(0);

const [count, setCount] = fromStore(countStore);

$$(() => {
  let counter = $store(countStore);

  $sync(console.log('Silmaril Count:', counter));
});

createEffect(() => {
  console.log('SolidJS Count:', count());
});

setInterval(() => {
  setCount((current) += 1);
}, 1000);
```

## License

MIT © [lxsmnsyc](https://github.com/lxsmnsyc)
