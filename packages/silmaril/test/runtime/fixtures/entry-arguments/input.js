import { $$, $sync } from 'silmaril';

$$(() => {
  $sync(log('a'), log('b'));
});
