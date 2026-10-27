import { $$root, $$get, $$set, $$sync, $$destroy } from 'silmaril';

// Root scope. slot 0: y
// entries: 0 first $sync (body with its own slots), 1 second $sync
// A write to y runs entry 0 of the child scope of entry 0 (path [0, 0]),
// and entry 1. It does not run entry 0 itself: its body reads y only
// inside the inner $sync.
const $g0 = [[1, [0, 0]]];

// Child scope of entry 0. slot 0: x
// entry 0: inner $sync
const $g1 = [[0]];

let setY;

const stop = $$root($g0, ($s) => {
  $$set($s, 0, 0);
  $$sync(
    $s,
    0,
    ($c0) => {
      $$set($c0, 0, 0);
      log('body');
      $$sync($c0, 0, () => log('inner', $$get($c0, 0), $$get($s, 0)));
      $$destroy($c0, () => log('body destroyed'));
      $$set($c0, 0, $$get($c0, 0) + 1);
    },
    $g1,
  );
  $$sync($s, 1, ($c1) => {
    log('reads y', $$get($s, 0));
    $$destroy($c1, () => log('reads y destroyed'));
  });
  setY = (value) => {
    $$set($s, 0, value);
  };
});

setY(1);
stop();
