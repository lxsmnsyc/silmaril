import { $$root, $$composable, $$get, $$set, $$sync } from 'silmaril';

// Root scope. slot 0: outer. useInner is a plain local.
// entry 0: $sync of outer
const $g0 = [[0]];

// Composable scope: no slots. entry 0: $sync with no edge.
const $g1 = [];

$$root($g0, ($s) => {
  $$set($s, 0, 0);
  const useInner = $$composable($g1, ($s1) => {
    $$sync($s1, 0, () => log('inner reads outer', $$get($s, 0)));
  });
  useInner();
  $$sync($s, 0, () => log('outer', $$get($s, 0)));
  $$set($s, 0, 1);
});
