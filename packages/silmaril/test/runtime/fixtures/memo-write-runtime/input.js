import { $$, $sync } from 'silmaril';

function apply(fn, value) {
  fn(value);
}

let setX;

$$(() => {
  let x = 0;
  let a = 0;
  const b = a * 10;
  const writeA = (value) => {
    a = value;
  };
  const c = (apply(writeA, x), log('c computes with b', b), b);
  $sync(log('sync c', c));
  setX = (value) => {
    x = value;
  };
});

setX(1);
