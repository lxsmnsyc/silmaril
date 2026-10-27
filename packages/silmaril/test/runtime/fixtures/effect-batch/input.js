import { $$, $ } from 'silmaril';

let increment;
let bounce;

$$(() => {
  let count = 0;
  $(log('effect', count));
  increment = () => {
    count += 1;
  };
  bounce = () => {
    count = 10;
    count = 2;
  };
  log('setup');
});

log('after $$');
await tick();
increment();
increment();
log('written');
await tick();
bounce();
await tick();
log('done');
