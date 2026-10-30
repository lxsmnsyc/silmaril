import { $$root, $$get, $$set, $$effect, tick } from 'silmaril';

// slots: 0 count, 1 double
// entries: 0 $ that writes double, 1 $ of double
const $g0 = [[0], [1]];

let setCount;

$$root($g0, ($s) => {
  $$set($s, 0, 0);
  $$set($s, 1, 0);
  $$effect($s, 0, () => $$set($s, 1, $$get($s, 0) * 2));
  $$effect($s, 1, () => log('double', $$get($s, 1)));
  setCount = (value) => {
    $$set($s, 0, value);
  };
});

log('setup');
await tick();
log('first tick');
setCount(1);
await tick();
log('second tick');
const pending = tick();
setCount(2);
await pending;
log('third tick');
await tick();
log('empty tick');
