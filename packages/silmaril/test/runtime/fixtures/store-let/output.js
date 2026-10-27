import {
  $$root,
  $$get,
  $$set,
  $$sync,
  $$effect,
  $$store,
  tick,
} from 'silmaril';

// slot 0: current (bound to count, two way)
// entries: 0 write-back of current to count (numbered and run with the
//          memos, no first run), 1 $sync of current, 2 $ of current
const $g0 = [[0, 1, 2]];

function createStore(value) {
  const listeners = new Set();
  return {
    get: () => value,
    set(next) {
      if (!Object.is(value, next)) {
        value = next;
        for (const listener of listeners) {
          listener();
        }
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

const count = createStore(100);
count.subscribe(() => log('Raw Count:', count.get()));

$$root($g0, ($s) => {
  $$store($s, 0, count, 0);
  $$sync($s, 1, () => log('Sync Count:', $$get($s, 0)));
  $$effect($s, 2, () => log('Async Count:', $$get($s, 0)));
  $$set($s, 0, $$get($s, 0) + 100);
});

await tick();
count.set(300);
