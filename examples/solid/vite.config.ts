import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import silmaril from 'rollup-plugin-silmaril';

export default defineConfig({
  plugins: [
    solidPlugin(),
    silmaril({
      filter: {
        include: 'src/**/*.{ts,tsx}',
        exclude: 'node_modules/**/*.{ts,tsx}',
      },
    }),
  ],
});
