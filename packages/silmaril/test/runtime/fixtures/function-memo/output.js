import { $$root, $$get, $$set, $$memo, $$sync } from 'silmaril';

// slots: 0 count, 1 read. read is an arrow that reads count: a memo, as in 0.4.
// entries: 0 memo read, 1 $sync that passes read, 2 $sync that calls read
const $g0 = [[0], [1, 2]];

let setCount;
const seen = [];

$$root($g0, ($s) => {
  $$set($s, 0, 0);
  $$memo($s, 0, 1, () => () => $$get($s, 0));
  $$sync($s, 1, () => seen.push($$get($s, 1)));
  $$sync($s, 2, () => log('call', $$get($s, 1)()));
  setCount = (value) => {
    $$set($s, 0, value);
  };
});

setCount(1);
log('functions', seen.length, seen[0] === seen[1]);
