import { $$, $sync } from 'silmaril';

let setPoint;

$$(() => {
  let point = { x: 1, y: 2 };
  const { x, y } = point;
  $sync(log('x', x));
  $sync(log('y', y));
  setPoint = (value) => {
    point = value;
  };
});

setPoint({ x: 1, y: 3 });
