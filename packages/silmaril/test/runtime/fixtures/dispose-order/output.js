import { $$root, $$sync, $$effect, $$destroy, tick } from 'silmaril';

// No slots. entries: 0 $sync, 1 $. They register in source order: 1, then 0.
const $g0 = [];

const stop = $$root($g0, ($s) => {
  $$destroy($s, () => log('root'));
  $$effect($s, 1, ($c1) => {
    $$destroy($c1, () => log('$ child'));
  });
  $$sync($s, 0, ($c0) => {
    $$destroy($c0, () => log('$sync child'));
  });
});

await tick();
stop();
