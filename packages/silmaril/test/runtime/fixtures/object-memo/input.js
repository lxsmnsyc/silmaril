import { $$, $sync } from 'silmaril';

let setX;

$$(() => {
  let x = 1;
  const point = { x, y: x * 2 };
  $sync((log('point', point.x, point.y), x));
  setX = (value) => {
    x = value;
  };
});

setX(2);
