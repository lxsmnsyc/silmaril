---
id: website-skeleton
title: Documentation website built with brumate
status: active
priority: should
type: docs
milestone: docs
size: M
verify: pnpm --filter website build
owns:
  - website/**
shared:
  - pnpm-workspace.yaml
  - README.md
  - packages/silmaril/README.md
  - pnpm-lock.yaml
  - .github/workflows/ci.yml
depends_on: []
---

# Documentation website built with brumate

## Goal

Add a `website` workspace package built with brumate, with the layout, navigation, syntax highlighting and deploy setup of brumate's own website, and the current README split into pages (introduction, getting started, the guide sections, stores, Solid, bundler setup). Build it in CI.

## Context

- Template: https://github.com/lxsmnsyc/brumate/tree/main/website (markdown-it pages, twinkleplop highlighting, Vercel config, `scripts/`).

## Acceptance

- [ ] `pnpm --filter website build` produces the site; `pnpm --filter website dev` serves it.
- [ ] Every README section has a page; the README links to the site.
- [ ] CI builds the website.
- [ ] Fast check passes.

## Sizing

Known pattern from brumate, new to this repo, adds dependencies.

## Notes for the worker

- Pin brumate and twinkleplop versions that pass the repo's pnpm release-age policy.
- Hosting (Vercel, as brumate does) needs the user to connect the project; write the steps in the outcome.
