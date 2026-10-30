import { $$, $sync } from 'silmaril';

function fail() {
  throw new Error('memo');
}

let setX;

$$(() => {
  let x = 0;
  const y = x === 1 ? fail() : x * 2;
  $sync(log('y', y, 'x', x));
  setX = (value) => {
    x = value;
  };
});

try {
  setX(1);
} catch (error) {
  log('caught', error.message);
}
setX(2);
