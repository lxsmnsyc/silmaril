import { $$root, $$get, $$set, $$memo, $$sync } from 'silmaril';

// slots: 0 count, 1 prefix, 2 handler. label and format are function
// declarations: plain locals. handler reads count, so it is a memo, as in 0.4.
// entries: 0 memo handler, 1 $sync of format(count), 2 $sync of call(handler)
// Entry 1 reads prefix through format -> label. Entry 2 reads the handler slot.
const $g0 = [[0, 1], [1], [2]];

function call(fn) {
  return fn();
}

let setCount;
let setPrefix;

$$root($g0, ($s) => {
  $$set($s, 0, 0);
  $$set($s, 1, 'Count');

  function label() {
    return `${$$get($s, 1)}:`;
  }
  function format(value) {
    return `${label()} ${value}`;
  }
  $$memo($s, 0, 2, () => () => log('handler', $$get($s, 0)));

  $$sync($s, 1, () => log(format($$get($s, 0))));
  $$sync($s, 2, () => call($$get($s, 2)));

  setCount = (value) => {
    $$set($s, 0, value);
  };
  setPrefix = (value) => {
    $$set($s, 1, value);
  };
});

setCount(1);
setPrefix('Total');
