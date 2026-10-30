import { $$, $sync } from 'silmaril';

// The block-level var is the point of this fixture.
/* eslint-disable block-scoped-var */

$$(() => {
  log('hoisted', typeof v);
  var v = 1;
  $sync(log('v', v));
  v = 2;
  var v = 3;
  if (v) {
    var w = 1;
  }
  $sync(log('w', w));
  w = 2;
});
