import { $$root, $$get, $$set, $$sync } from 'silmaril';

// slots: 0 v, 1 w. w is declared in a block outside loops, so it gets
// a slot as in 0.4.
// entries: 0 $sync of v, 1 $sync of w
const $g0 = [[0], [1]];

$$root($g0, ($s) => {
  log('hoisted', typeof $$get($s, 0));
  $$set($s, 0, 1);
  $$sync($s, 0, () => log('v', $$get($s, 0)));
  $$set($s, 0, 2);
  $$set($s, 0, 3);
  if ($$get($s, 0)) {
    $$set($s, 1, 1);
  }
  $$sync($s, 1, () => log('w', $$get($s, 1)));
  $$set($s, 1, 2);
});
