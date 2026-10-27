import { $$root, $$get, $$set, $$sync } from 'silmaril';

// slots: 0 count, 1 prefix. label, format and handler are never
// reassigned, so they stay plain locals.
// entries: 0 $sync of format(count), 1 $sync of call(handler)
// Entry 0 reads prefix through format -> label. Entry 1 reads nothing,
// so no slot lists it.
const $g0 = [[0], [0]];

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
  const handler = () => log('handler', $$get($s, 0));

  $$sync($s, 0, () => log(format($$get($s, 0))));
  $$sync($s, 1, () => call(handler));

  setCount = (value) => {
    $$set($s, 0, value);
  };
  setPrefix = (value) => {
    $$set($s, 1, value);
  };
});

setCount(1);
setPrefix('Total');
