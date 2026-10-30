import { $$, $sync } from 'silmaril';

$$(() => {
  const user = { name: 'Ada' };

  $sync(console.log('name:', user.name));

  user.name = 'Grace';
  console.log('after the change:', user.name);
});
