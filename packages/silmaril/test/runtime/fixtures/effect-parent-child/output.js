import { $$root, $$get, $$set, $$sync, $$effect, tick } from 'silmaril';

// Root scope. slot 0: x. entry 0: $ with a body.
// Child scope of entry 0: entry 0 inner $sync (path [0, 0]).
const $g0 = [[0, [0, 0]]];

let setX;

$$root($g0, ($s) => {
  $$set($s, 0, 0);
  $$effect($s, 0, ($c0) => {
    log('effect', $$get($s, 0));
    $$sync($c0, 0, () => log('inner', $$get($s, 0)));
  });
  setX = (value) => {
    $$set($s, 0, value);
  };
});

await tick();
setX(1);
log('after write');
