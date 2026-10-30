import { $$, $sync } from 'silmaril';

let setY;

$$(() => {
  let y = 0;
  $sync(() => {
    let x = 0;
    log('body', y);
    $sync(log('inner', x));
    x = 1;
    log('body end');
  });
  setY = (value) => {
    y = value;
  };
});

setY(1);
