import * as silmaril from 'silmaril';

const stop = silmaril.$$(() => {
  log('setup');
});
log('returned', typeof stop);
stop();

const add = silmaril.$composable((a, b) => a + b);
log('composable', add(1, 2));
