import { $$, $sync } from 'silmaril';

let setX;

$$(() => {
  let x = 1;
  $sync(() => {
    const double = (log('compute'), x * 2);
    log('body', double);
    $sync(log('inner', double));
  });
  setX = (value) => {
    x = value;
  };
});

setX(2);
