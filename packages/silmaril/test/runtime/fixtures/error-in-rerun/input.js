import { $$, $, $sync, $skip, onMount, onDestroy, tick } from 'silmaril';

let setX;

const stop = $$(() => {
  let x = 0;
  $sync(() => {
    const value = $skip(x);
    onMount(() => log('mount', value));
    onDestroy(() => log('destroy', value));
    $(log('child effect', value));
    if (x === 1) {
      throw new Error('boom');
    }
  });
  setX = (next) => {
    x = next;
  };
});

await tick();
try {
  setX(1);
} catch (error) {
  log('caught', error.message);
}
await tick();
stop();
