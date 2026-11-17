import { defineConfig } from 'vitest/config';

// `solid-js` ships a server build that the `node` condition picks up, and
// the server build never runs effects. The Solid suite resolves the browser
// build in development mode instead, so that effects run and Solid's dev
// checks report misuse.
const SOLID_CONDITIONS = [
  'browser',
  'development',
  'import',
  'module',
  'default',
];

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'node',
          include: ['test/**/*.test.ts'],
          exclude: ['test/solid/**'],
        },
      },
      {
        resolve: { conditions: SOLID_CONDITIONS },
        ssr: { resolve: { conditions: SOLID_CONDITIONS } },
        test: {
          name: 'solid',
          include: ['test/solid/**/*.test.ts'],
        },
      },
    ],
  },
});
