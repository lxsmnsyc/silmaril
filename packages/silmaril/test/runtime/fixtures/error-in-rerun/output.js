import {
  $$root,
  $$get,
  $$set,
  $$sync,
  $$effect,
  $$mount,
  $$destroy,
  tick,
} from 'silmaril';

// Root scope. slot 0: x. entry 0: $sync with a body.
// value reads x only inside $skip, so it is a plain local.
// Child scope of entry 0: entry 0 is a $ that reads no slot.
const $g0 = [[0]];

let setX;

const stop = $$root($g0, ($s) => {
  $$set($s, 0, 0);
  $$sync($s, 0, ($c0) => {
    const value = $$get($s, 0);
    $$mount($c0, () => log('mount', value));
    $$destroy($c0, () => log('destroy', value));
    $$effect($c0, 0, () => log('child effect', value));
    if ($$get($s, 0) === 1) {
      throw new Error('boom');
    }
  });
  setX = (next) => {
    $$set($s, 0, next);
  };
});

await tick();
try {
  setX(1);
} catch (error) {
  log('caught', error.message);
}
await tick();
stop();
