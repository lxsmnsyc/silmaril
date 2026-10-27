# Computed variables

If a reactive variable references another, the variable becomes computed, which means that it will re-evaluate everytime the referenced variables changes.

```js
import { $$, $ } from 'silmaril';

$$(() => {
  // Create a "reactive" variable
  let count = 0;

  // Create a "reactive" const variable.
  const message = `Count: ${count}`;

  // This only tracks `message`
  $(console.log(message));

  count = 100; // Logs 'Count: 100'
});
```

Updates on computed variables are synchronous.

```js
import { $$ } from 'silmaril';

$$(() => {
  let count = 0;
  const message = `Count: ${count}`;
  count = 100; // message = Count: 100
  count = 200; // message = Count: 200
});
```

Computed variables are also writable if declared with `let`.

```js
import { $$, $sync } from 'silmaril';

$$(() => {
  let count = 0;
  let message = `Count: ${count}`;
  $sync(console.log('Log', message)); // Log Count: 0
  count = 100; // Log Count: 100
  message = 'Hello World'; // Log Hello World
  count = 200; // Log Count: 200
});
```
