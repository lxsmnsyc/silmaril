import { defineConfig } from 'vite';
import solidPlugin from '@solidjs/vite-plugin';
import silmaril from 'silmaril/unplugin';

export default defineConfig({
  plugins: [
    solidPlugin(),
    silmaril.vite({
      filter: {
        include: 'src/**/*.{ts,tsx}',
      },
    }),
  ],
});
