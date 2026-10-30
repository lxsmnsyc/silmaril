import { $$, $sync } from 'silmaril';

$$(() => {
  let x = 2;
  let a = 2;
  let b = 3;
  let flag = 0;
  let name = null;
  $sync(log('x', x));
  log('multiply', (x *= a + b));
  log('subtract', (x -= a - b));
  log('power', (x **= b - 1));
  log('in expression', 1 + (flag ||= a + b));
  log('and', (flag &&= a * b));
  log('nullish', (name ??= 'anonymous'));
  log('nullish again', (name ??= 'unused'));
  log('shorthand', { x, name });
  a = 0;
  b = 0;
});
