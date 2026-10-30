---
id: docs-guide
title: Rewrite the guide pages for 0.5
status: done
priority: should
type: docs
milestone: docs
size: M
added: 2026-10-30
verify: pnpm --filter website build && pnpm --filter website check:samples --strict
owns:
  - website/docs/index.md
  - website/docs/basic-reactivity.md
  - website/docs/computed-variables.md
  - website/docs/synchronous-tracking.md
  - website/docs/lifecycles.md
  - website/docs/composition.md
  - website/docs/stores.md
  - website/docs/solid.md
shared:
  - website/src/samples/**
depends_on:
  - on: website-skeleton
    kind: hard
    why: writes pages in the website.
  - on: runnable-samples
    kind: hard
    why: uses the live sample fences and check:samples that runnable-samples added.
  - on: reactivity-adr
    kind: contract
    via: reactivity-runtime
  - on: switch-to-v2
    kind: behavior
    via: reactivity-runtime
---

# Rewrite the guide pages for 0.5

## Goal

Rewrite the eight guide pages, which still hold the 0.4 README text, so they describe 0.5: what is reactive, when `$` and `$sync` run, memos, lifecycles, composables, stores and SolidJS interop. Turn the key examples into live samples that run in the page.

## Context

- The rules are in `contracts/reactivity-runtime.md` (Behavior and Compiler rules). The reasons and every change from 0.4 are in `decisions/0001-static-graph-runtime.md`.
- `runnable-samples`' outcome explains live samples: a `js live <name>.js` fence, with an empty body to read `website/src/samples/<name>.js`, and the expected-log assertions in `scripts/check-samples.ts`.
- Notes for these pages, collected from earlier nodes: one write that reaches more than 10,000 entries in one drain throws `Update loop`; helpers the compiler cannot follow are opaque (`compiler-core`'s outcome lists which); a read in a declaration-pattern default does not make a memo; `type T = typeof n` keeps naming a slot binding.
- `getting-started.md` and `bundler-setup.md` belong to `docs-reference`. Migration, internals and limits pages belong to `docs-migration`. Link to them by their planned names (`./migration.md`, `./internals.md`, `./limits.md`, `./api.md`); check whether the website build fails on a link to a page that does not exist yet; if it does, leave those links out and list them in the outcome.

## Acceptance

- [ ] The eight pages describe 0.5 only: no Babel, no `_$$context`, no 0.4 scheduling.
- [ ] Each page has at least one live sample whose expected logs `check:samples --strict` asserts.
- [ ] Every other code block compiles with `silmaril/compiler` (checked by a script or by hand, said in the outcome).
- [ ] The prose follows the plain-writing skill.
- [ ] Verify command passes.

## Notes for the worker

- Do not change the sidebar (`website/src/docs.ts`); these pages are already listed.

## Pull request

- #25, merged into `roadmap`.
