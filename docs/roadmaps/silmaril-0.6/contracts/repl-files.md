---
name: repl-files
version: 1
status: draft
defined_by: repl-files
---

# Contract: repl-files

## Purpose

The REPL examples and the share link format. `repl-page` and `live-sample-links` use it.

## Interface

`website/src/repl/files.ts`:

```ts
export interface Example { name: string; files: ReplFile[] }
export const examples: Example[];
/** URL-safe base64 of the JSON file list, no padding. */
export function encode(files: ReplFile[]): string;
/** undefined for a hash that is empty, broken, or has an invalid file name. A hash that is not JSON is one `index.js`. */
export function decode(hash: string): ReplFile[] | undefined;
/** An error sentence, or undefined when the name is valid and free. */
export function validName(name: string, taken: string[]): string | undefined;
```

The REPL lives at `/repl`; a share link is `/repl#<encode(files)>`.

## Behavior

- Same format as brumate's REPL (`brumate/website/src/repl/files.ts`), with `.js` and `.ts` names instead of `.brm`.

## Stub

None needed: the node is S and lands first.

## Contract tests

A round trip `decode(encode(files))` for each example, and `decode` of a hand-written bad hash, run by `check-samples.ts`.

## Changes

- v1: initial.
