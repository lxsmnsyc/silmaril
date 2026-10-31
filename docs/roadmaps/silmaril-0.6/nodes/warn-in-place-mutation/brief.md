---
id: warn-in-place-mutation
title: Warn on in-place mutation of a reactive variable
status: todo
priority: must
type: feature
milestone: 0.6.0
size: M
verify: pnpm --filter silmaril test
owns:
  - packages/silmaril/compiler/analysis/warnings/in-place-mutation.ts
  - packages/silmaril/test/compiler/analysis/warnings/in-place-mutation.test.ts
shared:
  - packages/silmaril/compiler/analysis/warnings/index.ts
depends_on:
  - on: compile-api
    kind: contract
    via: compile-result
---

# Warn on in-place mutation of a reactive variable

## Goal

Report `in-place-mutation` when code assigns to a member of a reactive variable (one with a slot): `user.name = x`, `user.name += 1`, `user.count++`, `delete user.name`, `user[key] = x`. These change the object but run nothing (`website/docs/limits.md`, "Mutation in place").

## Context

- Slots and their bindings are in the model (`ReactiveScope.slots`, `analysis/model.ts`). Write sites for whole-variable writes are found in `analysis/writes.ts`; member writes are what it leaves out.
- Message example: "`user.name = ...` changes `user` in place and runs nothing. Assign a new value, as in `user = { ...user, name }`."

## Acceptance

- [ ] Each form listed in the goal warns once, at the assignment.
- [ ] No warning for: a member write on a plain (slotless) variable, a write to the variable itself, a member write on a `$store` binding's value copy that is then assigned back in the same statement is still a warning (document the choice in the outcome), a member write inside `$skip(...)`.
- [ ] Method calls such as `list.push(x)` do not warn in this node. Write in the outcome whether a follow-up should cover them.
- [ ] Fast check passes. Changeset (`minor`, can be merged with others at release).

## Sizing

M: new pattern in this repo (warnings), one new file and tests, reads the model only.

## Notes for the worker

- Append one line to `WARNING_CHECKS`. Do not reorder the registry.
