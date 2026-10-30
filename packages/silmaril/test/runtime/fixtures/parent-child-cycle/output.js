import { $$root, $$get, $$set, $$sync } from 'silmaril';

// Root scope. slot 0: x. entry 0: outer $sync.
// Child scope of entry 0: entry 0 inner $sync, which reads x too (path [0, 0]).
const $g0 = [[0, [0, 0]]];

let runs = 0;
let getX;

$$root($g0, ($s) => {
  $$set($s, 0, 0);
  $$sync($s, 0, ($c0) => {
    runs += 1;
    log('outer', $$get($s, 0));
    $$sync($c0, 0, () => {
      if ($$get($s, 0) < 3) {
        $$set($s, 0, $$get($s, 0) + 1);
      }
    });
  });
  getX = () => $$get($s, 0);
});

log('outer runs', runs);
log('x', getX());
