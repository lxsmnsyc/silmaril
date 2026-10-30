import { $$root, $$get, $$set, $$sync } from 'silmaril';

// slots: 0 x, 1 y. entries: 0 $sync of x, 1 $sync of y
const $g0 = [[0], [1]];

$$root($g0, ($s) => {
  $$set($s, 0, 0);
  $$set($s, 1, 0);
  $$sync($s, 0, () => log('x', $$get($s, 0)));
  $$sync($s, 1, () => log('y', $$get($s, 1)));
  log('value', $$set($s, 0, $$set($s, 1, 1)));
});
