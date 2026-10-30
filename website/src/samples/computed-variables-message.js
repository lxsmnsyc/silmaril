import { $$, $ } from 'silmaril';

$$(() => {
  let count = 0;

  // Reads `count`, so `message` is computed
  const message = `Count: ${count}`;

  // Tracks `message` only
  $(console.log(message));

  count = 100;
});
