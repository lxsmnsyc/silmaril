import { $$root, $$get, $$set, $$memo, $$sync, $$effect } from 'silmaril';

function trace(label, value) {
  log(label, value);
  return value;
}

// slots: 0 count, 1 double
// Entry ids put memos first, then $sync, then $, whatever the source order:
// entries: 0 memo double, 1 $sync, 2 $
const $g0 = [[0, 1, 2], [2]];

let setCount;

$$root($g0, ($s) => {
  $$set($s, 0, 0);
  $$effect($s, 2, () => log('effect', $$get($s, 0), $$get($s, 1)));
  $$sync($s, 1, () => log('sync', $$get($s, 0)));
  $$memo($s, 0, 1, () => trace('memo', $$get($s, 0) * 2));
  setCount = (value) => {
    $$set($s, 0, value);
  };
});

setCount(1);
log('after write');
await tick();
setCount(2);
log('after write');
