---
id: playground
title: Playground with compiled output
status: dropped
priority: later
type: feature
milestone: docs
size: L
outline: true
depends_on:
  - on: runnable-samples
    kind: hard
    why: reuses the in-browser compiler setup, and its results decide whether a playground is needed.
---

# Playground with compiled output

## Goal

An editor page that shows the source, the compiled output with source map highlighting, and the logs. Parked until runnable samples show whether it adds enough.

Dropped 2026-10-31: replaced by the `repl` story in `docs/roadmaps/silmaril-0.6`.
