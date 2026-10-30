import { $$root, $$get, $$effect, $$store, $$destroy, tick } from 'silmaril';

// slot 0: value. entry 0: $ of value
const $g0 = [[0]];

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
  $$root($g0, ($s) => {
    $$store($s, 0, st);
    $$destroy($s, () => log('destroyed'));
    $$effect($s, 0, () => log('effect', $$get($s, 0)));
    throw new Error('setup failed');
  });
} catch (error) {
  log('caught', error.message);
}

await tick();
st.set(1);
await tick();
