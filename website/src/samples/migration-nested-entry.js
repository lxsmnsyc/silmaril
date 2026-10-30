import { $$, $sync } from 'silmaril';

$$(() => {
  let outer = 0;
  let inner = 0;

  $sync(() => {
    console.log('outer body:', outer);

    $sync(console.log('nested:', inner));
  });

  inner = 1;
});
