import { $$, $sync } from 'silmaril';

function add(x, y) {
  log('compute d');
  return x + y;
}

$$(() => {
  let a = 1;
  const b = a * 2;
  const c = a + 1;
  const d = add(b, c);
  const parity = a % 2;
  $sync(log('d', d));
  $sync(log('parity', parity));

  a = 2;
  log('read after write', d);
  a = 4;
  a = 4;
});
