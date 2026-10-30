import { $$, $sync } from 'silmaril';

$$(() => {
  let a = 1;
  const { b = a } = {};

  $sync(console.log('b is', b));

  a = 2;
});
