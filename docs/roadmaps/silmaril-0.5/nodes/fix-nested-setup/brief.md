---
id: fix-nested-setup
title: Emit one context for a nested $$
status: released
priority: should
type: fix
milestone: 0.4.1
size: S
added: 2026-10-27
verify: pnpm --filter silmaril test
owns:
  - packages/silmaril/babel/index.ts
  - packages/silmaril/test/compiler.test.ts
  - .changeset/nested-setup-single-context.md
depends_on:
  - on: fix-babel-plugin
    kind: hard
    why: edits the same CallExpression visitors in babel/index.ts; must merge after it.
---

# Emit one context for a nested $$

## Goal

A `$$` nested inside another `$$` compiles with two `_$$context()` declarations: the inner setup is transformed once by the outer `transformSetup` and again by the top-level `CallExpression` visitor. Transform each setup once.

## Context

- Found by the review of PR #5. Reproduction:

  ```js
  import { $$, $ } from 'silmaril';
  $$(() => {
    let a = 0;
    $$(() => {
      $(console.log(a));
    });
    a = 1;
  });
  ```

  Output today has `let _ctx3 = _$$context(); let _ctx2 = _$$context();` in the inner setup.

## Acceptance

- [ ] A test with the reproduction above shows exactly one `_$$context()` per setup body. Write it first and show it fails on the base.
- [ ] Existing snapshots are unchanged, unless a snapshot contains the duplicate, in which case the outcome lists it.
- [ ] Patch changeset for `silmaril`.
- [ ] Fast check passes.

## Sizing

One guard against transforming a setup twice, plus a test.

## Notes for the worker

- Whether the inner `$(console.log(a))` should track the outer `a` is a separate question for the maintainer (the README says reactions stay inside their `$$`). Do not change tracking in this node.

## Pull request

- #12, merged into `roadmap`. Tracking of outer variables by a nested `$$` stays as in 0.4 for 0.4.1 (maintainer, 2026-10-30).
- Released in silmaril 0.4.1 from `main` (#21, cherry-picked).
