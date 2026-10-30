import { $$, $sync } from 'silmaril';

let setY;

$$(() => {
  let y = 0;
  $sync(() => {
    $sync(log('A', y));
  });
  $sync(() => {
    $sync(log('B', y));
  });
  setY = (value) => {
    y = value;
  };
});

setY(1);
