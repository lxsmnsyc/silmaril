import { $$, $sync, $store } from 'silmaril';

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

const stop = $$(() => {
  const value = $store(counter);
  $sync(log('value', value));
});

counter.set(2);
stop();
counter.set(3);
