import { $$root, $$get, $$set, $$sync } from 'silmaril';

// slots: 0 celsius, 1 fahrenheit
// entries: 0 $sync that writes fahrenheit, 1 $sync that writes celsius,
// 2 $sync of both
const $g0 = [
  [0, 2],
  [1, 2],
];

let setCelsius;
let setFahrenheit;

$$root($g0, ($s) => {
  $$set($s, 0, 100);
  $$set($s, 1, 0);
  $$sync($s, 0, () => $$set($s, 1, ($$get($s, 0) * 9) / 5 + 32));
  $$sync($s, 1, () => $$set($s, 0, (($$get($s, 1) - 32) * 5) / 9));
  $$sync($s, 2, () => log('C', $$get($s, 0), 'F', $$get($s, 1)));
  setCelsius = (value) => {
    $$set($s, 0, value);
  };
  setFahrenheit = (value) => {
    $$set($s, 1, value);
  };
});

setCelsius(0);
setFahrenheit(212);
setFahrenheit(-40);
