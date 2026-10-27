import { $$, $, $sync, $store, tick } from 'silmaril';

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

$$(() => {
  let current = $store(count);
  $sync(log('Sync Count:', current));
  $(log('Async Count:', current));
  current += 100;
});

await tick();
count.set(300);
