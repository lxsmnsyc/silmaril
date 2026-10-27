import { $$, $, onMount, onDestroy } from 'silmaril';

let setCount;

const stop = $$(() => {
  let count = 0;
  $(() => {
    log('run', count);
    onMount(() => log('mounted', count));
    onDestroy(() => log('cleanup', count));
  });
  setCount = (value) => {
    count = value;
  };
});

await tick();
setCount(1);
await tick();
stop();
