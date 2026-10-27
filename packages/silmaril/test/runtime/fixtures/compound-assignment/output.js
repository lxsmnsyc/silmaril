import { $$root, $$get, $$set, $$sync } from 'silmaril';

// slots: 0 x, 1 a, 2 b, 3 flag, 4 name
// entry 0: $sync of x
const $g0 = [[0]];

$$root($g0, ($s) => {
  $$set($s, 0, 2);
  $$set($s, 1, 2);
  $$set($s, 2, 3);
  $$set($s, 3, 0);
  $$set($s, 4, null);
  $$sync($s, 0, () => log('x', $$get($s, 0)));
  log('multiply', $$set($s, 0, $$get($s, 0) * ($$get($s, 1) + $$get($s, 2))));
  log('subtract', $$set($s, 0, $$get($s, 0) - ($$get($s, 1) - $$get($s, 2))));
  log('power', $$set($s, 0, $$get($s, 0) ** ($$get($s, 2) - 1)));
  log(
    'in expression',
    1 + ($$get($s, 3) || $$set($s, 3, $$get($s, 1) + $$get($s, 2))),
  );
  log('and', $$get($s, 3) && $$set($s, 3, $$get($s, 1) * $$get($s, 2)));
  log('nullish', $$get($s, 4) ?? $$set($s, 4, 'anonymous'));
  log('nullish again', $$get($s, 4) ?? $$set($s, 4, 'unused'));
  log('shorthand', { x: $$get($s, 0), name: $$get($s, 4) });
  $$set($s, 1, 0);
  $$set($s, 2, 0);
});
