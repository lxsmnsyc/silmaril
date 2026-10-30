import { $$, $sync, $skip } from 'silmaril';

let setA;
let setB;

$$(() => {
  let a = 0;
  let b = 0;
  $sync(log('a', a, 'b', $skip(b)));
  const sum = a + $skip(b);
  $sync(log('sum', sum));
  setA = (value) => {
    a = value;
  };
  setB = (value) => {
    b = value;
  };
});

setB(5);
setA(1);
