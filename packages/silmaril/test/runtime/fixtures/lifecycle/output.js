import { $$root, $$get, $$set, $$sync, $$mount, $$destroy } from 'silmaril';

// slot 0: count
// entry 0: $sync with a body
const $g0 = [[0]];

let setCount;

const stop = $$root($g0, ($s) => {
  $$set($s, 0, 0);
  $$mount($s, () => log('mount root'));
  $$destroy($s, () => log('destroy root'));
  $$sync($s, 0, ($c0) => {
    log('count', $$get($s, 0));
    $$mount($c0, () => log('mount child'));
    $$destroy($c0, () => log('destroy child'));
  });
  setCount = (value) => {
    $$set($s, 0, value);
  };
  log('setup');
});

log('before stop');
stop();
stop();
setCount(1);
log('done');
