import { $$, $sync } from 'silmaril';

let setX;

$$(() => {
  let x = 0;
  $sync(() => {
    const d = (log('memo d'), x * 2);
    log('outer', x, d);
  });
  setX = (value) => {
    x = value;
  };
});

setX(1);
