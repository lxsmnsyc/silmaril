# Log: sample-highlighting

- Highlighting reuses twinkleplop, as the markdown plugin does. `website/src/live/highlight.ts` wraps `@twinkleplop/typescript` (the plugin highlights `js` fences with it), so the colors are the same classes and theme variables. No new dependency.
- Layout follows brumate's REPL editor: a gutter `pre`, then a body with the highlighted backdrop in the flow (it sets the height, with a trailing line break) and the textarea absolute over it. Scrolling of the textarea is copied to the backdrop.
- brumate 0.3.0 differs from the version of the brumate site: `ref=$bind(x)` does not compile here, `ref=x` does.
- `event.preventDefault()` in a handler is too late: brumate runs handlers after the event has dispatched, so Tab still moved focus. The `prevent(handler, 'Tab')` wrapper from `brumate/events` works. It also prevents Shift+Tab (Shift does not count as a modifier), which would trap keyboard users. The handler therefore moves focus itself: Escape blurs the textarea, Shift+Tab focuses the Run button.
- Browser (Chrome extension, preview of the build on port 4291, my own tab, closed after): see outcome.
