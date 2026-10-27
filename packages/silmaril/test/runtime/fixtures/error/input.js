import { $$, $sync } from 'silmaril';

let setCount;

$$(() => {
  let count = 0;
  $sync(() => {
    if (count === 1) {
      throw new Error('boom');
    }
  });
  $sync(log('after', count));
  setCount = (value) => {
    count = value;
  };
});

try {
  setCount(1);
} catch (error) {
  log('caught', error.message);
}
setCount(2);
