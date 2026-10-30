import { $$root, $$get, $$set, $$sync, $$store } from 'silmaril';

// slots: 0 v (two way), 1 w (one way), 2 go
// entries: 0 write-back of v, 1 $sync of go, v and w
const $g0 = [[0, 1], [1], [1]];

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

$$root($g0, ($s) => {
  $$store($s, 0, st, 0);
  $$store($s, 1, st);
  $$set($s, 2, false);
  $$sync($s, 1, () => {
    if ($$get($s, 2)) {
      $$set($s, 0, 5);
      log('store', st.get(), 'v', $$get($s, 0), 'w', $$get($s, 1));
    }
  });
  start = () => {
    $$set($s, 2, true);
  };
});

start();
log('after write', st.get());
