import { $$root, $$get, $$set, $$memo, $$sync } from 'silmaril';

function add(x, y) {
  log('compute d');
  return x + y;
}

// slots: 0 a, 1 b, 2 c, 3 d, 4 parity
// entries: 0 memo b, 1 memo c, 2 memo d, 3 memo parity,
//          4 $sync of d, 5 $sync of parity
const $g0 = [[0, 1, 3], [2], [2], [4], [5]];

$$root($g0, ($s) => {
  $$set($s, 0, 1);
  $$memo($s, 0, 1, () => $$get($s, 0) * 2);
  $$memo($s, 1, 2, () => $$get($s, 0) + 1);
  $$memo($s, 2, 3, () => add($$get($s, 1), $$get($s, 2)));
  $$memo($s, 3, 4, () => $$get($s, 0) % 2);
  $$sync($s, 4, () => log('d', $$get($s, 3)));
  $$sync($s, 5, () => log('parity', $$get($s, 4)));

  $$set($s, 0, 2);
  log('read after write', $$get($s, 3));
  $$set($s, 0, 4);
  $$set($s, 0, 4);
});
