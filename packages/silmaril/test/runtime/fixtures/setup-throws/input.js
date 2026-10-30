import { $$, $, $store, onDestroy, tick } from 'silmaril';

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
      return () => {
        listeners.delete(listener);
        log('unsubscribed');
      };
    },
  };
}

const st = createStore(0);

try {
  $$(() => {
    const value = $store(st);
    onDestroy(() => log('destroyed'));
    $(log('effect', value));
    throw new Error('setup failed');
  });
} catch (error) {
  log('caught', error.message);
}

await tick();
st.set(1);
await tick();
