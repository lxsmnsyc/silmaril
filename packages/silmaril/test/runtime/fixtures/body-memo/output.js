import { $$root, $$get, $$set, $$memo, $$sync } from 'silmaril';

// Root scope. slot 0: x. entry 0: $sync with a body.
// The body reads x through its memo double. The memo reads x (path [0, 0]).
const $g0 = [[0, [0, 0]]];

// Child scope of entry 0. slot 0: double.
// entries: 0 memo double, 1 inner $sync of double
const $g1 = [[1]];

let setX;

$$root($g0, ($s) => {
  $$set($s, 0, 1);
  $$sync(
    $s,
    0,
    ($c0) => {
      $$memo($c0, 0, 0, () => (log('compute'), $$get($s, 0) * 2));
      log('body', $$get($c0, 0));
      $$sync($c0, 1, () => log('inner', $$get($c0, 0)));
    },
    $g1,
  );
  setX = (value) => {
    $$set($s, 0, value);
  };
});

setX(2);
