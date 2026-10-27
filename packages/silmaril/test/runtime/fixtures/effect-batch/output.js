import { $$root, $$get, $$set, $$effect } from 'silmaril';

// slot 0: count
// entry 0: $ of count
const $g0 = [[0]];

let increment;
let bounce;

$$root($g0, ($s) => {
  $$set($s, 0, 0);
  $$effect($s, 0, () => log('effect', $$get($s, 0)));
  increment = () => {
    $$set($s, 0, $$get($s, 0) + 1);
  };
  bounce = () => {
    $$set($s, 0, 10);
    $$set($s, 0, 2);
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
