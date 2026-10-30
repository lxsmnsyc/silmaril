import { describe, expect, it } from 'vitest';
import type { UnpluginOptions } from 'unplugin';
import silmaril, { type SilmarilPluginOptions } from '../unplugin';

const SOURCE = `
import { $$ } from 'silmaril';

$$(() => {
  let x = 0;
  x += 1;
});
`;

function getTransform(options?: SilmarilPluginOptions) {
  const plugin = silmaril.raw(options, {
    framework: 'rollup',
    versions: {},
  }) as UnpluginOptions;
  const transform = plugin.transform;
  if (!transform || typeof transform === 'function') {
    throw new Error('Expected an object transform hook.');
  }
  return transform;
}

describe('unplugin', () => {
  it('should filter modules that do not import silmaril', () => {
    const { filter } = getTransform();
    expect(filter?.code).toBe('silmaril');
  });

  it('should only include JS and TS files by default', () => {
    const { filter } = getTransform();
    const { include } = (filter?.id ?? {}) as { include: RegExp };
    expect(include.test('/src/a.ts')).toBe(true);
    expect(include.test('/src/a.mjs')).toBe(true);
    expect(include.test('/src/a.tsx')).toBe(true);
    expect(include.test('/src/a.css')).toBe(false);
  });

  it('should forward the user filter', () => {
    const { filter } = getTransform({
      filter: { include: 'src/**/*.ts', exclude: 'node_modules/**' },
    });
    expect(filter?.id).toEqual({
      include: 'src/**/*.ts',
      exclude: 'node_modules/**',
    });
  });

  it('should compile TypeScript modules', async () => {
    const { handler } = getTransform();
    const result = await handler.call(
      {} as never,
      `${SOURCE}\nconst y: number = 1;`,
      '/src/example.ts',
    );
    expect(result).toMatchObject({
      code: expect.stringContaining('$$set($s, 0,'),
      map: expect.objectContaining({ mappings: expect.any(String) }),
    });
  });

  it('should ignore the query when picking the language', async () => {
    const { handler } = getTransform();
    const result = await handler.call(
      {} as never,
      `${SOURCE}\nconst y: number = 1;`,
      '/src/example.ts?v=1',
    );
    expect(result).toMatchObject({
      code: expect.stringContaining('const y: number = 1;'),
    });
  });

  it('should leave modules with no compile-time import unchanged', async () => {
    const { handler } = getTransform();
    const result = await handler.call(
      {} as never,
      "import Store from 'silmaril/store';\nnew Store(0);",
      '/src/example.ts',
    );
    expect(result).toBeUndefined();
  });
});
