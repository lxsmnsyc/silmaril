import { $$, $sync } from 'silmaril';

$$(() => {
  let x = 0;
  let a = 0;
  const b = a * 10;
  const c = ((a = x), log('c reads b', b), b);
  $sync(log('sync c', c));
  x = 1;
});
