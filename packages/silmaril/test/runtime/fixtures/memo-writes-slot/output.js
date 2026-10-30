import { $$root, $$get, $$set, $$memo, $$sync } from 'silmaril';

// slots: 0 x, 1 a, 2 b, 3 c
// entries: 0 memo b, 1 memo c, which reads x and b and writes a, 2 $sync of c
const $g0 = [[1], [0], [1], [2]];

$$root($g0, ($s) => {
  $$set($s, 0, 0);
  $$set($s, 1, 0);
  $$memo($s, 0, 2, () => $$get($s, 1) * 10);
  $$memo(
    $s,
    1,
    3,
    () => (
      $$set($s, 1, $$get($s, 0)),
      log('c reads b', $$get($s, 2)),
      $$get($s, 2)
    ),
  );
  $$sync($s, 2, () => log('sync c', $$get($s, 3)));
  $$set($s, 0, 1);
});
