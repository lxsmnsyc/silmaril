import { $$, $sync, $store } from 'silmaril';

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

$$(() => {
  let v = $store(st);
  $sync(log('v', v));
  setV = (value) => {
    v = value;
  };
});

setV(2);
st.set(3);
