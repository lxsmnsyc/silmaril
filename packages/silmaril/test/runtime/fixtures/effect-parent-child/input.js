import { $$, $, $sync, tick } from 'silmaril';

let setX;

$$(() => {
  let x = 0;
  $(() => {
    log('effect', x);
    $sync(log('inner', x));
  });
  setX = (value) => {
    x = value;
  };
});

await tick();
setX(1);
log('after write');
