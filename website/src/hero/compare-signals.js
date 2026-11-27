import { createSignal, createMemo, createEffect } from 'solid-js';

const [count, setCount] = createSignal(0);
const double = createMemo(() => count() * 2);

createEffect(double, (value) => console.log(value));

setCount(count() + 1);
