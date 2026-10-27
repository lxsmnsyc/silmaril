import {
  $$root,
  $$get,
  $$set,
  $$effect,
  $$mount,
  $$destroy,
  tick,
} from 'silmaril';

// slot 0: count
// entry 0: $ with a body. Each run gets a new child scope, $c0.
const $g0 = [[0]];

let setCount;

const stop = $$root($g0, ($s) => {
  $$set($s, 0, 0);
  $$effect($s, 0, ($c0) => {
    log('run', $$get($s, 0));
    $$mount($c0, () => log('mounted', $$get($s, 0)));
    $$destroy($c0, () => log('cleanup', $$get($s, 0)));
  });
  setCount = (value) => {
    $$set($s, 0, value);
  };
});

await tick();
setCount(1);
await tick();
stop();
