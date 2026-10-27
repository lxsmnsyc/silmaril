import { $$, $sync } from 'silmaril';

let setCount;
const seen = [];

$$(() => {
  let count = 0;
  const read = () => count;
  $sync(seen.push(read));
  $sync(log('call', read()));
  setCount = (value) => {
    count = value;
  };
});

setCount(1);
log('functions', seen.length, seen[0] === seen[1]);
