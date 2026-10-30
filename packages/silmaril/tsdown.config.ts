import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    compiler: 'compiler/index.ts',
    store: 'store/index.ts',
    solid: 'solid/index.ts',
    unplugin: 'unplugin/index.ts',
  },
  format: 'esm',
  platform: 'node',
  target: 'es2022',
  dts: true,
  sourcemap: true,
  exports: true,
});
