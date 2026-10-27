import { $$, $sync, onDestroy } from 'silmaril';

let setY;

const stop = $$(() => {
  let y = 0;
  $sync(() => {
    let x = 0;
    log('body');
    $sync(log('inner', x, y));
    onDestroy(() => log('body destroyed'));
    x += 1;
  });
  $sync(() => {
    log('reads y', y);
    onDestroy(() => log('reads y destroyed'));
  });
  setY = (value) => {
    y = value;
  };
});

setY(1);
stop();
