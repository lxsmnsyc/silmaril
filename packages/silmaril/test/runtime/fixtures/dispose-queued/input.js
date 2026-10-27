import { $$, $, onMount, onDestroy, tick } from 'silmaril';

let setX;

const stop = $$(() => {
  let x = 0;
  $(() => {
    log('effect', x);
    onMount(() => log('mounted'));
    onDestroy(() => log('cleanup'));
  });
  setX = (value) => {
    x = value;
  };
});

await tick();
setX(1);
stop();
await tick();
