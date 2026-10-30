import { $$, $, tick } from 'silmaril';

let setCount;

$$(() => {
  let count = 0;
  let double = 0;
  $((double = count * 2));
  $(log('double', double));
  setCount = (value) => {
    count = value;
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
