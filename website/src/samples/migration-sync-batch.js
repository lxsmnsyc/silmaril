import { $$, $sync } from 'silmaril';

$$(() => {
  let trigger = 0;
  let a = 0;

  $sync(console.log('a is', a));

  $sync(() => {
    if (trigger) {
      a = 1;
      a = 0;
    }
  });

  trigger = 1;
});
