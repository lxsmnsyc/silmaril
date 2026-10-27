import { $$root, $$get, $$set, $$sync, $$store } from 'silmaril';

// slot 0: v. entries: 0 write-back of v, which reads v, 1 $sync of v
const $g0 = [[0, 1]];

function createStore(value) {
  const listeners = new Set();
  return {
    get: () => value,
    set(next) {
      log('set', next);
      value = next;
      for (const listener of listeners) {
        listener();
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

const st = createStore(1);
let setV;

$$root($g0, ($s) => {
  $$store($s, 0, st, 0);
  $$sync($s, 1, () => log('v', $$get($s, 0)));
  setV = (value) => {
    $$set($s, 0, value);
  };
});

setV(2);
st.set(3);
