import { $$, $, $sync } from 'silmaril';

function trace(label, value) {
  log(label, value);
  return value;
}

let setCount;

$$(() => {
  let count = 0;
  $(log('effect', count, double));
  $sync(log('sync', count));
  const double = trace('memo', count * 2);
  setCount = (value) => {
    count = value;
  };
});

setCount(1);
log('after write');
await tick();
setCount(2);
log('after write');
