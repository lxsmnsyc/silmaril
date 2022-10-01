const code = `
import { $$, $, onDestroy } from 'silmaril';

$$(() => {
  let y = 0;
  $(() => {
    let x = 0;

    $(console.log(x + y));

    onDestroy(() => {
      console.log('This will be cleaned up when \`y\` changes');
    });

    x += 100;
  });
  y += 100;
});
`;
