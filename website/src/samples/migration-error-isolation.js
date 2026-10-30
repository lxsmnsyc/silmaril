import { $$, $sync } from 'silmaril';

$$(() => {
  let n = 0;

  $sync(() => {
    if (n > 0) {
      throw new Error('first failed');
    }
  });
  $sync(console.log('second ran with', n));

  try {
    n = 1;
  } catch (error) {
    console.log('write threw:', error.message);
  }
});
