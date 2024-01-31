import { defineConfig } from 'vite';
import silmaril from 'vite-plugin-silmaril';
import solidPlugin from 'vite-plugin-solid';

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
