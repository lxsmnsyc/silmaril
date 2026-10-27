import { $$root, $$get, $$set, $$memo, $$sync } from 'silmaril';

// slots: 0 x, 1 point. entries: 0 memo point, 1 $sync of point and x
// An object literal or a sequence after () => needs parentheses.
const $g0 = [[0, 1], [1]];

let setX;

$$root($g0, ($s) => {
  $$set($s, 0, 1);
  $$memo($s, 0, 1, () => ({ x: $$get($s, 0), y: $$get($s, 0) * 2 }));
  $$sync(
    $s,
    1,
    () => (log('point', $$get($s, 1).x, $$get($s, 1).y), $$get($s, 0)),
  );
  setX = (value) => {
    $$set($s, 0, value);
  };
});

setX(2);
