import { $$root, $$get, $$set, $$memo, $$sync } from 'silmaril';

// slots: 0 x, 1 a, 2 b, 3 c. writeA is a plain local.
// entries: 0 memo b, 1 memo c, 2 $sync of c
const $g0 = [[1], [0], [1], [2]];

function apply(fn, value) {
  fn(value);
}

let setX;

$$root($g0, ($s) => {
  $$set($s, 0, 0);
  $$set($s, 1, 0);
  $$memo($s, 0, 2, () => $$get($s, 1) * 10);
  const writeA = (value) => {
    $$set($s, 1, value);
  };
  $$memo(
    $s,
    1,
    3,
    () => (
      apply(writeA, $$get($s, 0)),
      log('c computes with b', $$get($s, 2)),
      $$get($s, 2)
    ),
  );
  $$sync($s, 2, () => log('sync c', $$get($s, 3)));
  setX = (value) => {
    $$set($s, 0, value);
  };
});

setX(1);
