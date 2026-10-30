import { $$root, $$get, $$set, $$memo, $$sync } from 'silmaril';

// Root scope. slot 0: x. entry 0: $sync with a body.
// The body reads x, and memo d of its child scope reads x (path [0, 0]).
const $g0 = [[0, [0, 0]]];

// Child scope of entry 0. slot 0: d. entry 0: memo d.
// The body reads d, but d is its own slot: no entry is listed for it.
const $g1 = [];

let setX;

$$root($g0, ($s) => {
  $$set($s, 0, 0);
  $$sync(
    $s,
    0,
    ($c0) => {
      $$memo($c0, 0, 0, () => (log('memo d'), $$get($s, 0) * 2));
      log('outer', $$get($s, 0), $$get($c0, 0));
    },
    $g1,
  );
  setX = (value) => {
    $$set($s, 0, value);
  };
});

setX(1);
