import { $$root, $$get, $$sync, $$store } from 'silmaril';

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
      log('subscribed');
      return () => {
        listeners.delete(listener);
        log('unsubscribed');
      };
    },
  };
}

const counter = createStore(1);

// slot 0: value (bound to counter, one way)
// entry 0: $sync of value
const $g0 = [[0]];

const stop = $$root($g0, ($s) => {
  $$store($s, 0, counter);
  $$sync($s, 0, () => log('value', $$get($s, 0)));
});

counter.set(2);
stop();
counter.set(3);
