import {
  $$root,
  $$composable,
  $$get,
  $$set,
  $$sync,
  $$store,
  $$mount,
  $$destroy,
} from 'silmaril';

// Graphs go right after the imports.
// Root scope. slots: 0 input (two way), 1 squared (one way)
// entries: 0 write-back of input (numbered with the memos), 1 $sync of input, 2 $sync of squared
const $g0 = [[0, 1], [2]];

// Composable scope. slot 0: input. squared is never reassigned: a plain local.
// entry 0: $sync that writes squared
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

// The setup takes its scope first, then the caller's arguments.
const useSquared = $$composable($g1, ($s, store) => {
  $$store($s, 0, store);
  const squared = createStore(0);
  $$mount($s, () => log('squared mounted'));
  $$destroy($s, () => log('squared destroyed'));
  $$sync($s, 0, () => squared.set($$get($s, 0) ** 2));
  return squared;
});

let setInput;

const stop = $$root($g0, ($s) => {
  const source = createStore(0);
  $$store($s, 0, source, 0);
  $$store($s, 1, useSquared(source));
  $$sync($s, 1, () => log('Value', $$get($s, 0)));
  $$sync($s, 2, () => log('Squared', $$get($s, 1)));
  $$mount($s, () => log('root mounted'));
  setInput = (value) => {
    $$set($s, 0, value);
  };
});

setInput(3);
stop();

try {
  useSquared(createStore(1));
} catch (error) {
  log('outside a scope', error.message);
}
