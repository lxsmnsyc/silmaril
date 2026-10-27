import { $$, $sync } from 'silmaril';

try {
  $$(() => {
    let a = 0;
    let b = 0;
    $sync((b = a + 1));
    $sync((a = b + 1));
  });
} catch (error) {
  log('setup', error.message);
}

let start;
let stop;

$$(() => {
  let loop = false;
  let a = 0;
  let b = 0;
  $sync(loop && (b = a + 1));
  $sync(loop && (a = b + 1));
  $sync(log('loop', loop));
  start = () => {
    loop = true;
  };
  stop = () => {
    loop = false;
  };
});

try {
  start();
} catch (error) {
  log('caught', error.message);
}
stop();
try {
  start();
} catch (error) {
  log('caught again', error.message);
}
