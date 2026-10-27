import { $$, $sync } from 'silmaril';

function call(fn) {
  return fn();
}

let setCount;
let setPrefix;

$$(() => {
  let count = 0;
  let prefix = 'Count';

  function label() {
    return `${prefix}:`;
  }
  function format(value) {
    return `${label()} ${value}`;
  }
  const handler = () => log('handler', count);

  // Reads count, and prefix through format and label.
  $sync(log(format(count)));
  // handler is passed, not called by name: its reads are not added.
  $sync(call(handler));

  setCount = (value) => {
    count = value;
  };
  setPrefix = (value) => {
    prefix = value;
  };
});

setCount(1);
setPrefix('Total');
