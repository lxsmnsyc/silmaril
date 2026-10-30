---
id: sample-highlighting
title: Highlight the code of live samples
status: done
priority: should
type: feature
milestone: docs
size: S
added: 2026-10-30
verify: pnpm --filter website build && pnpm --filter website check:samples --strict
owns:
  - website/src/components/LiveSample.brm
  - website/src/live/**
  - website/src/styles.css
shared:
  - website/package.json
  - pnpm-lock.yaml
depends_on:
  - on: runnable-samples
    kind: hard
    why: changes the live sample component that runnable-samples added.
---

# Highlight the code of live samples

## Goal

Live samples show their source in a plain textarea and their compiled code as plain text, while static code blocks on the site are highlighted. Highlight both, the way brumate's website does, with the same highlighter the static blocks use.

## Context

- brumate's `website/src/components/LiveSample.brm` (local copy at `/Users/alexis/Documents/GitHub/brumate`, or https://github.com/lxsmnsyc/brumate/tree/main/website): a highlighted `live-backdrop` div sits under a transparent `textarea`, the highlight is a memo of the source plus a trailing line break so the heights match, and `onScroll` keeps the backdrop's scroll in step. The compiled output is highlighted too. `website/src/repl/highlight.ts` there wraps twinkleplop; the CSS for `.live-editor`, `.live-backdrop` and the textarea is in its `styles.css`.
- This site already highlights static blocks with twinkleplop in the markdown plugin (`website/plugins/markdown.ts`). Reuse that setup rather than adding a second highlighter.

## Acceptance

- [ ] The editor of every live sample is highlighted, and typing, selection, caret, scrolling and wrapping line up with the highlight (checked in a browser, light and dark theme).
- [ ] The Compiled tab is highlighted.
- [ ] The colors match the static code blocks.
- [ ] Verify command passes, and `pnpm format:check`.

## Pull request

- #29, merged into `roadmap`.
