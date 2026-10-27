// The only script before the first interaction: the loader of brumate.
import { hotLoad } from 'brumate/hot';
import { start } from 'brumate/loader';
import { load } from 'virtual:brumate/manifest';

start({
  // On the dev server, an edit of a component can update the page without a reload.
  load: hotLoad(import.meta.hot, load),
  navigate: { transition: true },
});

if (import.meta.env.DEV) {
  void import('brumate/devtools').then(({ installDevtools }) =>
    installDevtools(),
  );
}
