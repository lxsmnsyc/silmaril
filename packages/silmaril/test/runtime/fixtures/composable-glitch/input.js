import { $$, $sync, $store, $composable } from 'silmaril';

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

const useSquared = $composable((store) => {
  const input = $store(store);
  const out = createStore(0);
  $sync(out.set(input ** 2));
  return out;
});

let setInput;

$$(() => {
  const source = createStore(2);
  let input = $store(source);
  const squared = $store(useSquared(source));
  $sync(log('input', input, 'squared', squared));
  setInput = (value) => {
    input = value;
  };
});

setInput(3);
