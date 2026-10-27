import { $$, $sync } from 'silmaril';

$$(() => {
  let x = 0;
  $sync(() => {
    if (x < 3) {
      x += 1;
    }
  });
  $sync(log('x', x));
});
