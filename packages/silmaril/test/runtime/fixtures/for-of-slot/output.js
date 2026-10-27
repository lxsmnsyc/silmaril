import { $$root, $$get, $$set, $$sync } from 'silmaril';

// slots: 0 item, 1 key, 2 left, 3 right
// entries: 0 $sync of item, 1 $sync of key, 2 $sync of left and right
const $g0 = [[0], [1], [2], [2]];

$$root($g0, ($s) => {
  let $t3, $t4;
  $$set($s, 0, '');
  $$set($s, 1, '');
  $$set($s, 2, 0);
  $$set($s, 3, 0);
  $$sync($s, 0, () => log('item', $$get($s, 0)));
  $$sync($s, 1, () => log('key', $$get($s, 1)));
  $$sync($s, 2, () => log('pair', $$get($s, 2), $$get($s, 3)));
  for (const $t0 of ['a', 'b']) {
    $$set($s, 0, $t0);
    log('loop', $$get($s, 0));
  }
  for (const $t1 in { x: 1, y: 2 }) {
    $$set($s, 1, $t1);
    log('key loop', $$get($s, 1));
  }
  for (const $t2 of [[1, 2]]) {
    [$t3, $t4] = $t2;
    $$set($s, 2, $t3);
    $$set($s, 3, $t4);
    log('pair loop');
  }
});
