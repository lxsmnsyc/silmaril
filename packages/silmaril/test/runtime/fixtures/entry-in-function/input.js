import { $$, $sync } from 'silmaril';

$$(() => {
  let x = 0;
  setTimeout(() => {
    $sync(log('x', x));
  });
  x = 1;
});
