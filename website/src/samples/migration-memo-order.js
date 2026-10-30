import { $$, $sync } from 'silmaril';

$$(() => {
  let n = 1;
  const double = n * 2;
  const quad = double * 2;

  $sync(console.log(n, double, quad));

  n = 5;
});
