import { $$, $sync } from 'silmaril';

$$(() => {
  let a = 0;
  let b = 0;
  $sync(log('a', a, 'b', b));
  class Pair {
    value = ([a, b] = [1, 2]);
  }
  log('value', new Pair().value);
});
