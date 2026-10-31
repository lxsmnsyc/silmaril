---
name: repl-run
version: 1
status: draft
defined_by: repl-runner
---

# Contract: repl-run

## Purpose

How the REPL page runs a set of files. `repl-runner` implements it in `website/src/live/run.ts`; `repl-page` calls it. Live samples keep calling `runSample`, which becomes a one-file call of the same code.

## Interface

```ts
export interface ReplFile {
  /** `[\w-]+\.(js|ts)`. The first file is the entry. */
  name: string;
  source: string;
}

export interface FileOutput {
  name: string;
  /** Compiled module, or the source when the compiler returned it unchanged. */
  code: string;
  warnings: CompileWarning[];
  /** From compile(..., { graph: true }). null for a module with nothing to compile. */
  graph: string | null;
}

export interface RunFilesResult {
  files: FileOutput[];
  /** First CompileError or runtime error, with the file name. Logs up to it are kept. */
  error: { file: string; message: string; frame: string | null } | null;
  ran: boolean;
  logs: string[];
  dispose: () => void;
}

export function runFiles(
  files: ReplFile[],
  options?: RunOptions,
): Promise<RunFilesResult>;
```

## Behavior

- Files import each other with `./<name>`, with or without the extension. Imports of `silmaril` and `silmaril/store` resolve to the runtime as today. Any other import is an error on that file.
- Every file is compiled, also the ones the entry does not import, so their warnings and graph show.
- Same isolation as `runSample`: a new run with the same `owner` disposes the last one.

## Stub

Until `repl-runner` lands, `repl-page` can wrap `runSample` on the first file and return one `FileOutput` with `warnings: []` and `graph: null`.

## Contract tests

`website/scripts/check-samples.ts` runs a two-file case (an entry that imports a helper) and checks the logs.

## Changes

- v1: initial.
