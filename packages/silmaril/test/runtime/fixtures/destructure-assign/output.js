import { $$root, $$get, $$set, $$sync } from 'silmaril';

// slots: 0 a, 1 b, 2 rest, 3 first, 4 others. target is a plain local.
// entries: 0 $sync of a, b and rest, 1 $sync of first and others
const $g0 = [[0], [0], [0], [1], [1]];

$$root($g0, ($s) => {
  // One temp per target and per used right side, declared first.
  let $t0, $t1, $t2, $t3, $t4, $t5, $t6, $t7, $t8, $t9;
  $$set($s, 0, 0);
  $$set($s, 1, 0);
  $$set($s, 2, []);
  const target = { p: 0 };
  $$sync($s, 0, () => log('values', $$get($s, 0), $$get($s, 1), $$get($s, 2)));
  log(
    'result',
    String(
      (([$t1, { q: $t2 = $t1 * 10 } = {}, target.p, ...$t3] = $t0 =
        [1, undefined, 7, 8, 9]),
      $$set($s, 0, $t1),
      $$set($s, 1, $t2),
      $$set($s, 2, $t3),
      $t0),
    ),
  );
  log('target', target.p);
  // In statement position the value is not used, so the right side needs
  // no temp, and the writes can be separate statements.
  ({ a: $t4, ...$t5 } = { a: 2, z: 3 });
  $$set($s, 0, $t4);
  $$set($s, 2, $t5);

  [$t6 = 5, ...$t7] = [undefined, 1];
  $$set($s, 3, $t6);
  $$set($s, 4, $t7);
  $$sync($s, 1, () => log('first', $$get($s, 3), $$get($s, 4)));
  [$t8, $t9] = [$$get($s, 3) + 1, []];
  $$set($s, 3, $t8);
  $$set($s, 4, $t9);
});
