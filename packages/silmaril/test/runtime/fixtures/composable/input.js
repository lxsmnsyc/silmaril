import { $$, $sync, $store, $composable, onMount, onDestroy } from 'silmaril';

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
  const squared = createStore(0);
  onMount(() => log('squared mounted'));
  onDestroy(() => log('squared destroyed'));
  $sync(squared.set(input ** 2));
  return squared;
});

let setInput;

const stop = $$(() => {
  const source = createStore(0);
  let input = $store(source);
  const squared = $store(useSquared(source));
  $sync(log('Value', input));
  $sync(log('Squared', squared));
  onMount(() => log('root mounted'));
  setInput = (value) => {
    input = value;
  };
});

setInput(3);
stop();

try {
  useSquared(createStore(1));
} catch (error) {
  log('outside a scope', error instanceof Error);
}
