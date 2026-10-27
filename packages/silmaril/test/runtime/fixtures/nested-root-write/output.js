import { $$root, $$get, $$set, $$sync } from 'silmaril';

// Outer root. slot 0: outer. entry 0: $sync of outer
const $g0 = [[0]];

// Inner root. slot 0: local. entry 0: $sync of local (outer has no edge)
const $g1 = [[0]];

let bump;

$$root($g0, ($s) => {
  $$set($s, 0, 0);
  $$sync($s, 0, () => log('outer', $$get($s, 0)));
  $$root($g1, ($s1) => {
    $$set($s1, 0, 0);
    $$sync($s1, 0, () => log('inner', $$get($s1, 0), $$get($s, 0)));
    bump = () => {
      $$set($s1, 0, $$get($s1, 0) + 1);
      $$set($s, 0, $$get($s, 0) + 1);
    };
  });
});

bump();
bump();
