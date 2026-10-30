import { $$, $sync } from 'silmaril';

$$(() => {
  let a = 0;
  let b = 0;

  $sync(console.log('reads a:', a));
  $sync(console.log('reads b:', b));

  a = 1;
});
