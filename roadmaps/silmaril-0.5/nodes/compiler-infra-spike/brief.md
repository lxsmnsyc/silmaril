---
id: compiler-infra-spike
title: Spike oxc-parser, scope analysis and magic-string
status: done
priority: must
type: spike
milestone: 0.5.0
size: M
spike: true
owns:
  - roadmaps/silmaril-0.5/nodes/compiler-infra-spike/**
provides: [compiler-api]
depends_on: []
---

# Spike oxc-parser, scope analysis and magic-string

## Goal

Answer, with a small prototype, how `silmaril/compiler` parses, resolves bindings and edits code. Choose the scope analysis (periscopic, oxc's own semantic data if exposed to JS, or a small builder of our own), check that it handles every case `babel/index.ts` relies on, and propose the final `compiler-api` contract.

## Context

- The Babel plugin depends on `scope.getBindingIdentifier`, `generateUidIdentifier`, `scope.crawl()` after edits, and traversal with `skip()`. List which of these the new design needs and how each is replaced, given that magic-string edits text and the AST is not updated.
- brumate already compiles with oxc-parser: https://github.com/lxsmnsyc/brumate (see `docs/compiler.md`). Its website uses `@oxc-parser/binding-wasm32-wasi` in the browser.

## Acceptance

- [ ] Prototype in this node folder parses TS and TSX, resolves bindings with shadowing, and rewrites `let x` writes into calls with a correct source map.
- [ ] It runs in a browser through the wasm binding, or the outcome says what blocks it.
- [ ] Parse plus analysis time on a 2,000-line file, against the Babel plugin.
- [ ] A proposed `compiler-api.md` with the internal analysis API filled in, and answers for the three open points in it: async loading of the wasm binding, the source map type, and the tsdown platform of the `compiler` entry.

## Sizing

Unknown libraries (high uncertainty), but throwaway code in the node folder.

## Notes for the worker

- Do not add dependencies to `packages/silmaril`. Install what you try inside the node folder.

## Pull request

- #9, merged into `roadmap`.
