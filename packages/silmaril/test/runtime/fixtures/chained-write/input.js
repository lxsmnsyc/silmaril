import { $$, $sync } from 'silmaril';

$$(() => {
  let x = 0;
  let y = 0;
  $sync(log('x', x));
  $sync(log('y', y));
  log('value', (x = y = 1));
});
