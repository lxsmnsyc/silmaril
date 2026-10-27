import { $$, $sync } from 'silmaril';

$$(() => {
  let x = 0;
  if (x === 0) {
    let y = 10;
    const z = x + y;
    $sync(log('z', z));
    x = 1;
    y = 20;
  }
  for (const n of [1, 2]) {
    let w = n;
    w += 1;
    log('loop', w);
  }
});
