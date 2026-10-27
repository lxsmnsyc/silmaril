import { $$root, $$get, $$set, $$sync, $$destroy } from 'silmaril';

// Outer root. slot 0: outer. No entry of its own reads it, so the
// trailing empty list is left out.
const $g0 = [];

// Inner root: no slots. entry 0: $sync that reads outer without an edge,
// because a nested $$ is a separate root.
const $g1 = [];

let setOuter;
let stopInner;

const stopOuter = $$root($g0, ($s) => {
  $$set($s, 0, 0);
  stopInner = $$root($g1, ($s1) => {
    $$sync($s1, 0, () => log('inner reads outer', $$get($s, 0)));
    $$destroy($s1, () => log('inner destroyed'));
  });
  $$destroy($s, () => log('outer destroyed'));
  setOuter = (value) => {
    $$set($s, 0, value);
  };
});

setOuter(1);
stopOuter();
stopInner();
