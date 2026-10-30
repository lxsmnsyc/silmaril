// A small inline script that runs before brumate. It is a plain script, so it
// loads nothing and does not count against what brumate ships.

/**
 * Applies the saved theme before the page paints, so it does not flash. A client navigation of
 * brumate replaces the attributes of the root element with those of the next page, which drops
 * `data-theme`, so an observer puts the last chosen theme back before the next paint.
 */
export const THEME_SCRIPT = `<script>(function(){var r=document.documentElement,t;try{t=localStorage.getItem('theme')}catch(e){}if(t)r.dataset.theme=t;new MutationObserver(function(){if(r.dataset.theme)t=r.dataset.theme;else if(t)r.dataset.theme=t}).observe(r,{attributeFilter:['data-theme']})})()</script>`;
