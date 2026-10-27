import { defineConfig } from 'vite';
import silmaril from 'silmaril/unplugin';

export default defineConfig({
  plugins: [
    silmaril.vite({
      filter: {
        include: 'src/**/*.ts',
      },
    }),
  ],
});
