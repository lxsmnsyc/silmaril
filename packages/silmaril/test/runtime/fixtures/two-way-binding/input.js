import { $$, $sync } from 'silmaril';

let setCelsius;
let setFahrenheit;

$$(() => {
  let celsius = 100;
  let fahrenheit = 0;
  $sync((fahrenheit = (celsius * 9) / 5 + 32));
  $sync((celsius = ((fahrenheit - 32) * 5) / 9));
  $sync(log('C', celsius, 'F', fahrenheit));
  setCelsius = (value) => {
    celsius = value;
  };
  setFahrenheit = (value) => {
    fahrenheit = value;
  };
});

setCelsius(0);
setFahrenheit(212);
setFahrenheit(-40);
