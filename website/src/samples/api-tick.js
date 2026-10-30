import { $$, $, tick } from 'silmaril';

$$(() => {
  let count = 0;

  $(console.log('Count:', count));

  count = 1;
  count = 2;
});

// The `$` body runs once, with `Count: 2`.
await tick();
console.log('Done');
