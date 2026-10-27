import { $$, $sync } from 'silmaril';

let runs = 0;
let getX;

$$(() => {
  let x = 0;
  $sync(() => {
    runs += 1;
    log('outer', x);
    $sync(() => {
      if (x < 3) {
        x = x + 1;
      }
    });
  });
  getX = () => x;
});

log('outer runs', runs);
log('x', getX());
