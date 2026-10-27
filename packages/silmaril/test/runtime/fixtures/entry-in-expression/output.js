import { $$root, $$get, $$set, $$sync } from 'silmaril';

// A short circuit in statement position is the point of this fixture.
/* oxlint-disable no-unused-expressions */

// slot 0: x. on and off are plain consts.
// entries: 0 $sync behind on, 1 $sync behind off, which never registers
const $g0 = [[0, 1]];

let setX;

$$root($g0, ($s) => {
  $$set($s, 0, 0);
  const on = true;
  const off = false;
  on && $$sync($s, 0, () => log('on', $$get($s, 0)));
  off && $$sync($s, 1, () => log('off', $$get($s, 0)));
  setX = (value) => {
    $$set($s, 0, value);
  };
});

setX(1);
