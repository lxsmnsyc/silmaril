import { $$root, $$get, $$set, $$memo, $$sync } from 'silmaril';

// slots: 0 a, 1 b, 2 sum
// entries: 0 memo sum, 1 $sync of a and b, 2 $sync of sum
// $skip(b) reads b without an edge, so slot 1 lists no entry.
const $g0 = [[0, 1], [], [2]];

let setA;
let setB;

$$root($g0, ($s) => {
  $$set($s, 0, 0);
  $$set($s, 1, 0);
  $$sync($s, 1, () => log('a', $$get($s, 0), 'b', $$get($s, 1)));
  $$memo($s, 0, 2, () => $$get($s, 0) + $$get($s, 1));
  $$sync($s, 2, () => log('sum', $$get($s, 2)));
  setA = (value) => {
    $$set($s, 0, value);
  };
  setB = (value) => {
    $$set($s, 1, value);
  };
});

setB(5);
setA(1);
