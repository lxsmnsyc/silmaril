import { $$root, $$get, $$set, $$memo, $$sync } from 'silmaril';

// slots: 0 a, 1 t. u is a plain local.
// entries: 0 memo t, 1 $sync of t
const $g0 = [[0], [1]];

$$root($g0, ($s) => {
  $$set($s, 0, 1);
  function label() {
    return `a=${$$get($s, 0)}`;
  }
  $$memo($s, 0, 1, () => label());
  const u = $$get($s, 0) + 1;
  $$sync($s, 1, () => log('t', $$get($s, 1), 'u', u));
  $$set($s, 0, 2);
});
