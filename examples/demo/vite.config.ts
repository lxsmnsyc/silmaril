import silmaril from 'unplugin-silmaril';

export default {
  plugins: [
    silmaril.vite({
      filter: {
        include: 'src/**/*.ts',
        exclude: 'node_modules/**/*.{ts,js}',
      },
    }),
  ],
};
