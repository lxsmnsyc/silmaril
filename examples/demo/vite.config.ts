import silmaril from 'rollup-plugin-silmaril';

export default {
  plugins: [
    silmaril({
      filter: {
        include: 'src/**/*.ts',
        exclude: 'node_modules/**/*.{ts,js}',
      },
    }),
  ],
};