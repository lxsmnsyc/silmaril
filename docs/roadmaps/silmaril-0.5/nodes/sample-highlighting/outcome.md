# Outcome: sample-highlighting

## Built

- `website/src/live/highlight.ts`: `highlight(code)` returns the twinkleplop HTML (TypeScript grammar, as the markdown plugin uses for `js`) as a `Raw` value.
- `website/src/components/LiveSample.brm`: the editor is a highlighted backdrop under a transparent textarea, with a line-number gutter. The highlight is a memo of the source plus a trailing line break, so the heights match. The textarea scrolls the backdrop, vertically and horizontally. The Compiled tab shows the compiled code highlighted.
- Editor keys and attributes: Tab inserts two spaces with `setRangeText`. Escape leaves the editor (blur) and Shift+Tab moves focus to the Run button. `spellcheck="false"`, `autocomplete`, `autocapitalize` and `autocorrect` off.
- The focus ring moved from the textarea to the editor (`:has(textarea:focus-visible)`), as in brumate's REPL.

## Deviations

- Shift+Tab is not left to the browser, as the scope addition asked. `onKeyDown` handlers run after the event has dispatched, so `preventDefault()` in the handler cannot stop Tab. The `prevent(handler, 'Tab')` wrapper does, and it prevents Shift+Tab too. The handler moves focus itself: Shift+Tab to the Run button, Escape blurs the editor. Both were checked in the browser.
- The editor grows with its source, so only the page scrolls vertically. The backdrop and gutter still follow the textarea's vertical scroll if it ever has one.

## Stubs left

None.

## Gotchas

- In brumate 0.3.0 write `ref=name`, not `ref=$bind(name)`.
- Prevent keys with the `prevent` wrapper, not `event.preventDefault()`.
- Gutter, backdrop and textarea must share font, line height and padding, or the caret drifts.

## Proposed learnings

- Use the `prevent(handler, key)` wrapper to stop a key in brumate handlers | `event.preventDefault()` runs too late | `website/` | no

## Verification

- `pnpm install --frozen-lockfile`, `pnpm build`, `pnpm --filter website build`: pass.
- `pnpm --filter website check:samples --strict`: 31 samples, 0 problems. `pnpm format:check`, `pnpm lint`, `pnpm --filter website type-check`: pass.
- Browser (Chrome extension, the built site served by `node website/scripts/preview.ts` on port 4291): highlighted editor and gutter on the home page sample in dark and light theme; typing at the end of a line, with the highlight and caret aligned; a 150-character line scrolling horizontally, with textarea and backdrop at the same scrollLeft; Tab inserts two spaces and keeps focus; Shift+Tab moves focus to Run; typed edit recompiled (Logs and Compiled updated after 400 ms); Compiled tab highlighted (95 token spans); a 60-line source, with textarea, backdrop and gutter all 1334 px high and 60 numbers; shift+arrow selection aligned with the text; token colors of the sample equal those of a static code block (light theme). Escape was not pressed in the browser; the dark theme was checked for the highlight, gutter and Compiled tab, not for selection.

## Size

- Estimated S, actual S.
