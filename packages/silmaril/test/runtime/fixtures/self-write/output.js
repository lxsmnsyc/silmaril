import { $$root, $$get, $$set, $$sync } from 'silmaril';

// slot 0: x. entries: 0 clamping $sync, 1 $sync of x
const $g0 = [[0, 1]];

$$root($g0, ($s) => {
  $$set($s, 0, 0);
  $$sync($s, 0, () => {
    if ($$get($s, 0) < 3) {
      $$set($s, 0, $$get($s, 0) + 1);
    }
  });
  $$sync($s, 1, () => log('x', $$get($s, 0)));
});
