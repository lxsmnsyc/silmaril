import { $$, $sync } from 'silmaril';

$$(() => {
  let a = 0;
  let b = 0;

  $sync(console.log('a and b:', a, b));

  [a, b] = [1, 2];
});
