import { $$, $sync } from 'silmaril';

$$(() => {
  let y = 0;
  $sync(console.log('Count', y));

  y += 100;
});
