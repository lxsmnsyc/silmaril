import { $$root, $$get, $$set, $$memo, $$sync } from 'silmaril';

// slots: 0 x, 1 y. entries: 0 memo y, 1 $sync of y and x
const $g0 = [[0, 1], [1]];

function fail() {
  throw new Error('memo');
}

let setX;

$$root($g0, ($s) => {
  $$set($s, 0, 0);
  $$memo($s, 0, 1, () => ($$get($s, 0) === 1 ? fail() : $$get($s, 0) * 2));
  $$sync($s, 1, () => log('y', $$get($s, 1), 'x', $$get($s, 0)));
  setX = (value) => {
    $$set($s, 0, value);
  };
});

try {
  setX(1);
} catch (error) {
  log('caught', error.message);
}
setX(2);
