import { createRequire } from 'node:module';
import path from 'node:path';
import { defineConfig } from 'vite';

const require = createRequire(import.meta.url);

// `wasip1` (default): oxc-parser's browser entry imports @oxc-parser/binding-wasm32-wasip1 as is.
// `wasi`: the threaded binding, aliased under the wasip1 name like the brumate website does.
const binding = process.env.SPIKE_BINDING ?? 'wasip1';

export default defineConfig({
  root: import.meta.dirname,
  resolve: {
    alias:
      binding === 'wasi'
        ? {
            '@oxc-parser/binding-wasm32-wasip1': path.join(
              path.dirname(
                require.resolve('@oxc-parser/binding-wasm32-wasi/package.json'),
              ),
              'parser.wasi-browser.js',
            ),
          }
        : {},
  },
  optimizeDeps: {
    exclude: [
      'oxc-parser',
      '@oxc-parser/binding-wasm32-wasi',
      '@oxc-parser/binding-wasm32-wasip1',
    ],
  },
  worker: { format: 'es' },
  build: {
    target: 'es2023',
    outDir: path.join(import.meta.dirname, `dist-${binding}`),
    emptyOutDir: true,
  },
});
