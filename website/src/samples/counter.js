import { $$, $ } from 'silmaril';

$$(() => {
  let count = 0;

  $(console.log('Count:', count));

  count += 1;
  count *= 100;
});
