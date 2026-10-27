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
      return () => listeners.delete(listener);
    },
  };
}

const st = createStore(0);
let start;

$$(() => {
  let v = $store(st);
  const w = $store(st);
  let go = false;
  $sync(() => {
    if (go) {
      v = 5;
      log('store', st.get(), 'v', v, 'w', w);
    }
  });
  start = () => {
    go = true;
  };
});

start();
log('after write', st.get());
