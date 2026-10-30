// The 0.5 pipeline: silmaril/compiler and the runtime in src/v2, both from source.
// Imports use explicit `.ts` paths so the file loads under plain Node.
import { compile } from '../../../compiler/index.ts';
import * as runtime from '../../../src/v2/index.ts';
import type { Pipeline } from '../harness.ts';

// Cases that use $store, $composable, onMount, onDestroy or $skip wait for
// codegen-extras, which removes this. Until then such a case logs this marker in
// place of throwing, so it can be marked `xfail` on this pipeline.
const UNSUPPORTED = 'is not supported by the compiler yet.';

const pipeline: Pipeline = {
  name: 'compiler',
  compile(code, filename) {
    try {
      return compile(code, { filename, sourcemap: false }).code;
    } catch (error) {
      if (error instanceof Error && error.message.includes(UNSUPPORTED)) {
        return `log(${JSON.stringify(error.message)});`;
      }
      throw error;
    }
  },
  runtime,
};

export default pipeline;
