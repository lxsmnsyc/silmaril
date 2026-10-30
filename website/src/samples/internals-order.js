import { $$, $, $sync } from 'silmaril';

$$(() => {
  let n = 1;

  const double = n * 2;

  $(console.log('$ sees', n));
  $sync(console.log('$sync sees', n, 'and', double));

  n = 5;
});
