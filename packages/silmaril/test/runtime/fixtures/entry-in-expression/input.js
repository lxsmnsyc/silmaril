import { $$, $sync } from 'silmaril';

// A short circuit in statement position is the point of this fixture.
/* oxlint-disable no-unused-expressions */

let setX;

$$(() => {
  let x = 0;
  const on = true;
  const off = false;
  on && $sync(log('on', x));
  off && $sync(log('off', x));
  setX = (value) => {
    x = value;
  };
});

setX(1);
