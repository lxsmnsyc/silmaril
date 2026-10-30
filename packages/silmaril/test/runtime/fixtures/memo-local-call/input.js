import { $$, $sync, $skip } from 'silmaril';

$$(() => {
  let a = 1;
  function label() {
    return `a=${a}`;
  }
  const t = label();
  const u = $skip(a) + 1;
  $sync(log('t', t, 'u', u));
  a = 2;
});
