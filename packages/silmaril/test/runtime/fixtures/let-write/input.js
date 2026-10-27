import { $$, $sync } from 'silmaril';

$$(() => {
  let count = 0;
  $sync(log('count', count));
  count = 1;
  count = 1;
  count = 2;

  let other = NaN;
  $sync(log('other', String(other), Object.is(other, -0)));
  other = NaN;
  other = 0;
  other = -0;
});
