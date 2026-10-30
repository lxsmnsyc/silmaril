import { $$root, $$composable, $$get, $$set, $$sync, $$store } from 'silmaril';

// Root scope. slots: 0 input (two way), 1 squared (one way)
// entries: 0 write-back of input, 1 $sync
const $g0 = [[0, 1], [1]];

// Composable scope. slot 0: input. entry 0: $sync
const $g1 = [[0]];

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

const useSquared = $$composable($g1, ($s, store) => {
  $$store($s, 0, store);
  const out = createStore(0);
  $$sync($s, 0, () => out.set($$get($s, 0) ** 2));
  return out;
});

let setInput;

$$root($g0, ($s) => {
  const source = createStore(2);
  $$store($s, 0, source, 0);
  $$store($s, 1, useSquared(source));
  $$sync($s, 1, () => log('input', $$get($s, 0), 'squared', $$get($s, 1)));
  setInput = (value) => {
    $$set($s, 0, value);
  };
});

setInput(3);
