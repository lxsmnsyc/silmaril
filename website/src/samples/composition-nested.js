import { $$, $, onDestroy } from 'silmaril';

$$(() => {
  let y = 0;

  $(() => {
    let x = 0;

    // This read makes the outer body run again when `y` changes
    console.log('y is', y);

    $(console.log('x + y is', x + y));

    onDestroy(() => {
      console.log('Cleaned up');
    });

    x += 100;
  });

  setTimeout(() => {
    y += 100;
  }, 10);
});
