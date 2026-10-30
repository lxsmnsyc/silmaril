import { $$root, $$get, $$set, $$update, $$sync } from 'silmaril';

// slots: 0 n, 1 name, 2 a, 3 b
// entries: 0 $sync of n, 1 $sync of name, 2 $sync of a and b
const $g0 = [[0], [1], [2], [2]];

$$root($g0, ($s) => {
  // Temps of destructuring writes, one per site, declared first.
  let $t0, $t1, $t2;
  $$set($s, 0, 0);
  $$sync($s, 0, () => log('n', $$get($s, 0)));
  log('postfix', $$update($s, 0, 1, false));
  log('prefix', $$update($s, 0, 1, true));
  log('postfix decrement', $$update($s, 0, -1, false));
  log('compound', $$set($s, 0, $$get($s, 0) + 10));

  $$set($s, 1, '');
  $$sync($s, 1, () => log('name', $$get($s, 1)));
  log('or', $$get($s, 1) || $$set($s, 1, 'anonymous'));
  log('or', $$get($s, 1) || $$set($s, 1, 'unused'));

  $$set($s, 2, 1);
  $$set($s, 3, 2);
  $$sync($s, 2, () => log('pair', $$get($s, 2), $$get($s, 3)));
  // The pattern stays in place with temps as targets. Then each target
  // is its own write, in source order.
  log(
    'swap',
    (([$t1, $t2] = $t0 = [$$get($s, 3), $$get($s, 2)]),
    $$set($s, 2, $t1),
    $$set($s, 3, $t2),
    $t0),
  );
});
