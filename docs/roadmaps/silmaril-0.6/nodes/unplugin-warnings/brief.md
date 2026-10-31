---
id: unplugin-warnings
title: Report compiler warnings from silmaril/unplugin
status: todo
priority: must
type: feature
milestone: 0.6.0
size: S
verify: pnpm --filter silmaril test
owns:
  - packages/silmaril/test/unplugin.test.ts
shared:
  - packages/silmaril/unplugin/index.ts
depends_on:
  - on: compile-api
    kind: contract
    via: compile-result
---

# Report compiler warnings from silmaril/unplugin

## Goal

Forward each `CompileWarning` to the bundler with `this.warn`, with the module id and location, so Vite, Rollup and the others print it. Add `ignoreWarnings?: WarningCode[]` to `SilmarilPluginOptions` to drop codes.

## Context

- `packages/silmaril/unplugin/index.ts`. unplugin's `this.warn` takes a string or `{ message, id?, loc? }` depending on the bundler; check what unplugin types allow.

## Acceptance

- [ ] A test compiles a module through the plugin with a test-only check in `WARNING_CHECKS` and sees one warning with the code, message and location.
- [ ] `ignoreWarnings` drops that code.
- [ ] The returned code and map do not change.
- [ ] Fast check passes. Changeset.

## Sizing

S: one file and its test.
