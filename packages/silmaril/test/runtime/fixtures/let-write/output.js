import { $$root, $$get, $$set, $$sync } from 'silmaril';

// slot 0: count, slot 1: other
// entry 0: $sync of count, entry 1: $sync of other
const $g0 = [[0], [1]];

$$root($g0, ($s) => {
  $$set($s, 0, 0);
  $$sync($s, 0, () => log('count', $$get($s, 0)));
  $$set($s, 0, 1);
  $$set($s, 0, 1);
  $$set($s, 0, 2);

  $$set($s, 1, NaN);
  $$sync($s, 1, () =>
    log('other', String($$get($s, 1)), Object.is($$get($s, 1), -0)),
  );
  $$set($s, 1, NaN);
  $$set($s, 1, 0);
  $$set($s, 1, -0);
});
