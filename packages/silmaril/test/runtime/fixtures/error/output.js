import { $$root, $$get, $$set, $$sync } from 'silmaril';

// slot 0: count
// entries: 0 $sync that throws on 1, 1 $sync of count
const $g0 = [[0, 1]];

let setCount;

$$root($g0, ($s) => {
  $$set($s, 0, 0);
  $$sync($s, 0, () => {
    if ($$get($s, 0) === 1) {
      throw new Error('boom');
    }
  });
  $$sync($s, 1, () => log('after', $$get($s, 0)));
  setCount = (value) => {
    $$set($s, 0, value);
  };
});

try {
  setCount(1);
} catch (error) {
  log('caught', error.message);
}
setCount(2);
