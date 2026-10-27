import { $$root, $$get, $$set, $$sync } from 'silmaril';

// slots: 0 a, 1 b. entry 0: $sync of a and b
const $g0 = [[0], [0]];

$$root($g0, ($s) => {
  $$set($s, 0, 0);
  $$set($s, 1, 0);
  $$sync($s, 0, () => log('a', $$get($s, 0), 'b', $$get($s, 1)));
  class Pair {
    value = (() => {
      let $t0, $t1, $t2;
      return (
        ([$t1, $t2] = $t0 = [1, 2]), $$set($s, 0, $t1), $$set($s, 1, $t2), $t0
      );
    })();
  }
  log('value', new Pair().value);
});
