import { $$root, $$get, $$set, $$memo, $$sync } from 'silmaril';

// slots: 0 count, 1 message
// entries: 0 memo message, 1 $sync of message
const $g0 = [[0], [1]];

$$root($g0, ($s) => {
  $$set($s, 0, 0);
  $$memo($s, 0, 1, () => `Count: ${$$get($s, 0)}`);
  $$sync($s, 1, () => log('Log', $$get($s, 1)));
  $$set($s, 0, 100);
  $$set($s, 1, 'Hello World');
  $$set($s, 0, 200);
});
