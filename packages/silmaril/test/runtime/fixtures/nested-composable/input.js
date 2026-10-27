import { $$, $sync, $composable } from 'silmaril';

$$(() => {
  let outer = 0;
  const useInner = $composable(() => {
    $sync(log('inner reads outer', outer));
  });
  useInner();
  $sync(log('outer', outer));
  outer = 1;
});
