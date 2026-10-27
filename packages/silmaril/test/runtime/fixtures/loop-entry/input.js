import { $$, $ } from 'silmaril';

$$(() => {
  let x = 0;
  for (const i of [1, 2]) {
    $(log(i, x));
  }
  x = 1;
});
