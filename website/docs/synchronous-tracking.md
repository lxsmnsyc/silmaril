# Synchronous tracking

`$` is deferred by a timeout schedule which means that `$` asynchronously reacts on variable updates, this is so that updates on variables are batched by default (writing multiple times synchronously will only cause a single asynchronous update).

`$sync` provides synchronous tracking.

```js
import { $$, $, $sync } from 'silmaril';

$$(() => {
  // Create a "reactive" variable
  let count = 0;

  // Create a "reactive" const variable.
  const message = `Count: ${count}`;

  $sync(console.log('Sync', message)); // Logs "Sync Count: 0"
  $(console.log('Async', message));

  count = 100; // Logs "Sync Count: 100"
  count = 200; // Logs "Sync Count: 200"

  // After some time the code ends, logs "Async Count: 200"
});
```
