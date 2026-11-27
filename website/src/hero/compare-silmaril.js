import { $$, $ } from 'silmaril';

$$(() => {
  let count = 0;
  const double = count * 2;

  $(console.log(double));

  count += 1;
});
