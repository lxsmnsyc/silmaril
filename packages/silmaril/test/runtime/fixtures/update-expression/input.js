import { $$, $sync } from 'silmaril';

$$(() => {
  let n = 0;
  $sync(log('n', n));
  log('postfix', n++);
  log('prefix', ++n);
  log('postfix decrement', n--);
  log('compound', (n += 10));

  let name = '';
  $sync(log('name', name));
  log('or', (name ||= 'anonymous'));
  log('or', (name ||= 'unused'));

  let a = 1;
  let b = 2;
  $sync(log('pair', a, b));
  log('swap', ([a, b] = [b, a]));
});
