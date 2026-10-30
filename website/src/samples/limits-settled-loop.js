import { $$, $sync } from 'silmaril';

$$(() => {
  let n = 0;

  $sync(() => {
    if (n < 3) {
      n = n + 1;
    }
  });

  $sync(console.log('n is', n));
});
