import { $$root, $$get, $$set, $$sync } from 'silmaril';

// Root scope. slot 0: y. entries: 0 and 1, two $sync bodies.
// Each child scope has entry 0, an inner $sync that reads y.
// The refs are in the canonical order the compiler emits.
const $g0 = [
  [
    [0, 0],
    [1, 0],
  ],
];

let setY;

$$root($g0, ($s) => {
  $$set($s, 0, 0);
  $$sync($s, 0, ($c0) => {
    $$sync($c0, 0, () => log('A', $$get($s, 0)));
  });
  $$sync($s, 1, ($c1) => {
    $$sync($c1, 0, () => log('B', $$get($s, 0)));
  });
  setY = (value) => {
    $$set($s, 0, value);
  };
});

setY(1);
