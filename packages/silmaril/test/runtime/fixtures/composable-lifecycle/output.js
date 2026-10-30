import { $$root, $$composable, $$mount, $$destroy } from 'silmaril';

const $g0 = [];
const $g1 = [];

const useThing = $$composable($g0, ($s) => {
  $$mount($s, () => log('mount thing'));
  $$destroy($s, () => log('destroy thing'));
});

const stop = $$root($g1, ($s) => {
  $$mount($s, () => log('mount A'));
  $$destroy($s, () => log('destroy A'));
  useThing();
  $$mount($s, () => log('mount C'));
  $$destroy($s, () => log('destroy C'));
});

stop();
