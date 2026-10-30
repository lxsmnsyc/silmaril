import { $$root, $$get, $$set, $$sync } from 'silmaril';

// First root. slots: 0 a, 1 b
// entries: 0 $sync that writes b and reads a, 1 $sync that writes a and reads b
const $g0 = [[0], [1]];

// Second root. slots: 0 loop, 1 a, 2 b
// entries: 0 and 1 as above, gated by loop, 2 $sync of loop
const $g1 = [[0, 1, 2], [0], [1]];

try {
  $$root($g0, ($s) => {
    $$set($s, 0, 0);
    $$set($s, 1, 0);
    $$sync($s, 0, () => $$set($s, 1, $$get($s, 0) + 1));
    $$sync($s, 1, () => $$set($s, 0, $$get($s, 1) + 1));
  });
} catch (error) {
  log('setup', error.message);
}

let start;
let stop;

$$root($g1, ($s) => {
  $$set($s, 0, false);
  $$set($s, 1, 0);
  $$set($s, 2, 0);
  $$sync($s, 0, () => $$get($s, 0) && $$set($s, 2, $$get($s, 1) + 1));
  $$sync($s, 1, () => $$get($s, 0) && $$set($s, 1, $$get($s, 2) + 1));
  $$sync($s, 2, () => log('loop', $$get($s, 0)));
  start = () => {
    $$set($s, 0, true);
  };
  stop = () => {
    $$set($s, 0, false);
  };
});

try {
  start();
} catch (error) {
  log('caught', error.message);
}
stop();
try {
  start();
} catch (error) {
  log('caught again', error.message);
}
