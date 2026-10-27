import { $$, $sync } from 'silmaril';

let bump;

$$(() => {
  let outer = 0;
  $sync(log('outer', outer));
  $$(() => {
    let local = 0;
    $sync(log('inner', local, outer));
    bump = () => {
      local += 1;
      outer += 1;
    };
  });
});

bump();
bump();
