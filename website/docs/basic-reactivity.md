# Basic reactivity

`$$` defines the reactive boundary in your JS code. Any top-level variables (function-scoped) declared in `$$` will be treated as "reactive" as possible. `$` can be used to asynchronously react to variable changes.

Variable changes and reactions are only limited in `$$` (even for nested `$$` calls).

```js
import { $$, $ } from 'silmaril';

$$(() => {
  // Create a "reactive" variable
  let count = 0;

  // Log count for changes
  $(console.log('Count: ', count));

  function multiply() {
    // Update count
    count *= 100;
  }

  multiply();
  // After some time, this code logs `Count: 100`.
});
```

`$` will know which variables to track with, but it can only know if the variable is accessed in that same call.

```js
import { $$, $ } from 'silmaril';

$$(() => {
  // Create a "reactive" variable
  let count = 0;
  let prefix = 'Count';

  function log(current) {
    // `prefix` is not tracked
    console.log(`${prefix}: `, current);
  }

  // This only tracks `count`
  $(log(count));
});
```

`$` can also accept a function expression, and has the same tracking capabilities.

```js
$(() => {
  // This tracks `count`
  console.log('Count:', count);
});
```

`$` will only run if the tracked variables have actually changed (except for the first run), which means that it has some "auto-memoization".
