// The global stylesheet of the site, inlined into every page, so a page paints styled before any
// script runs.
import light from '@twinkleplop/theme-github/light?inline';
import search from './search/search.css?inline';
import site from './styles.css?inline';

// The fonts live in `public/fonts`, under the path the site is served from.
const base = import.meta.env.BASE_URL;

// The theme of twinkleplop gives the class of each token its color variable. The site's styles
// come after it and map those variables to the syntax colors of Banig, for both themes.
export const STYLES = `<style>${light}${site.replaceAll("url('/fonts/", `url('${base}fonts/`)}${search}</style>`;
