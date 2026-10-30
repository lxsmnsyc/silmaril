import { $$, $sync } from 'silmaril';

try {
  $$(() => {
    let n = 0;

    $sync(() => {
      n = n + 1;
    });
  });
} catch (error) {
  console.log(error.message);
}
