import { $$root, $$get, $$set, $$sync } from 'silmaril';

// Root scope. slot 0: y. entry 0: $sync with a body.
const $g0 = [[0]];

// Child scope of entry 0. slot 0: x. entry 0: inner $sync.
const $g1 = [[0]];

let setY;

$$root($g0, ($s) => {
  $$set($s, 0, 0);
  $$sync(
    $s,
    0,
    ($c0) => {
      $$set($c0, 0, 0);
      log('body', $$get($s, 0));
      $$sync($c0, 0, () => log('inner', $$get($c0, 0)));
      $$set($c0, 0, 1);
      log('body end');
    },
    $g1,
  );
  setY = (value) => {
    $$set($s, 0, value);
  };
});

setY(1);
