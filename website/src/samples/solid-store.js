import { $$, $sync, $store } from 'silmaril';

// The shape that `fromSignal` returns for a Solid signal: get, set and subscribe
let value = 0;
const listeners = new Set();
const countStore = {
  get() {
    return value;
  },
  set(next) {
    value = next;
    for (const listener of listeners) {
      listener(next);
    }
  },
  subscribe(callback) {
    listeners.add(callback);
    return () => listeners.delete(callback);
  },
};

$$(() => {
  let counter = $store(countStore);

  $sync(console.log('Silmaril Count:', counter));

  counter += 1;

  // A change from outside reaches the variable
  countStore.set(10);
});
