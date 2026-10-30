import { $$root, $$get, $$set, $$memo, $$sync } from 'silmaril';

// slots: 0 point, 1 x, 2 y
// entries: 0 memo { x, y } (slot -1: it writes its slots itself),
//          1 $sync of x, 2 $sync of y
const $g0 = [[0], [1], [2]];

let setPoint;

$$root($g0, ($s) => {
  $$set($s, 0, { x: 1, y: 2 });
  $$memo($s, 0, -1, () => {
    const { x, y } = $$get($s, 0);
    $$set($s, 1, x);
    $$set($s, 2, y);
  });
  $$sync($s, 1, () => log('x', $$get($s, 1)));
  $$sync($s, 2, () => log('y', $$get($s, 2)));
  setPoint = (value) => {
    $$set($s, 0, value);
  };
});

setPoint({ x: 1, y: 3 });
