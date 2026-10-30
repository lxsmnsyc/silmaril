import { $$, $sync } from 'silmaril';

$$(() => {
  let x = 0;
  $sync(log('x', /* $skip */ x));
  x = 1;
});
