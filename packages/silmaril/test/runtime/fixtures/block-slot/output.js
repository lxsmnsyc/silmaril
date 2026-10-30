import { $$root, $$get, $$set, $$memo, $$sync } from 'silmaril';

// slots: 0 x, 1 y, 2 z. y and z are declared in an if block outside
// loops, so they get slots, as in 0.4. w is declared in a loop: a plain local.
// entries: 0 memo z, 1 $sync of z
const $g0 = [[0], [0], [1]];

$$root($g0, ($s) => {
  $$set($s, 0, 0);
  if ($$get($s, 0) === 0) {
    $$set($s, 1, 10);
    $$memo($s, 0, 2, () => $$get($s, 0) + $$get($s, 1));
    $$sync($s, 1, () => log('z', $$get($s, 2)));
    $$set($s, 0, 1);
    $$set($s, 1, 20);
  }
  for (const n of [1, 2]) {
    let w = n;
    w += 1;
    log('loop', w);
  }
});
