// The 0.5 pipeline: silmaril/compiler and the runtime in src/v2, both from source.
// Imports use explicit `.ts` paths so the file loads under plain Node.
import { compile } from '../../../compiler/index.ts';
import * as runtime from '../../../src/v2/index.ts';
import type { Pipeline } from '../harness.ts';

const pipeline: Pipeline = {
  name: 'compiler',
  compile(code, filename) {
    return compile(code, { filename, sourcemap: false }).code;
  },
  runtime,
};

export default pipeline;
