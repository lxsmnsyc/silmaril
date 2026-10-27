import { $$root, $$get, $$set, $$sync } from 'silmaril';

// The block-level var is the point of this fixture.
/* eslint-disable block-scoped-var */

// slot 0: v. w is declared in a block: a plain local.
// entries: 0 $sync of v, 1 $sync of w (no slot, no edge)
const $g0 = [[0]];

$$root($g0, ($s) => {
  log('hoisted', typeof $$get($s, 0));
  $$set($s, 0, 1);
  $$sync($s, 0, () => log('v', $$get($s, 0)));
  $$set($s, 0, 2);
  $$set($s, 0, 3);
  if ($$get($s, 0)) {
    var w = 1;
  }
  $$sync($s, 1, () => log('w', w));
  w = 2;
});
