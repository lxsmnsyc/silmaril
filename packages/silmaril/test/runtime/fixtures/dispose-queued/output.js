import {
  $$root,
  $$get,
  $$set,
  $$effect,
  $$mount,
  $$destroy,
  tick,
} from 'silmaril';

// slot 0: x. entry 0: $ with a body
const $g0 = [[0]];

let setX;

const stop = $$root($g0, ($s) => {
  $$set($s, 0, 0);
  $$effect($s, 0, ($c0) => {
    log('effect', $$get($s, 0));
    $$mount($c0, () => log('mounted'));
    $$destroy($c0, () => log('cleanup'));
  });
  setX = (value) => {
    $$set($s, 0, value);
  };
});

await tick();
setX(1);
stop();
await tick();
