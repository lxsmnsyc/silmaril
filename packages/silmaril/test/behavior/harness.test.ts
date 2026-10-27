import { describe, expect, it } from 'vitest';
import * as runtime from '../../src';
import { checkCase, run } from './harness';
import type { Pipeline } from './harness';

const identity: Pipeline = {
  name: 'identity',
  compile: (code) => code,
  runtime,
  modules: { 'silmaril/extra': { value: 7, default: 'dflt' } },
};

async function logsOf(code: string, pipeline = identity) {
  const result = await run(pipeline, code);
  result.dispose();
  return result.logs;
}

describe('harness: xfail', { concurrent: false }, () => {
  const xfail = { xfail: ['identity'] };

  it('fails an xfail case that throws', async () => {
    await expect(
      checkCase(identity, {
        name: 'syntax error',
        code: 'let = ;',
        logs: [[1]],
        options: xfail,
      }),
    ).rejects.toThrow('Unexpected');
  });

  it('fails an xfail case that cannot resolve an import', async () => {
    await expect(
      checkCase(identity, {
        name: 'bad import',
        code: "import x from 'nope'; log(x);",
        logs: [[1]],
        options: xfail,
      }),
    ).rejects.toThrow('Cannot resolve import');
  });

  it('fails an xfail case that now passes', async () => {
    await expect(
      checkCase(identity, {
        name: 'passes',
        code: 'log(1);',
        logs: [[1]],
        options: xfail,
      }),
    ).rejects.toThrow('now passes');
  });

  it('passes an xfail case whose logs differ', async () => {
    await expect(
      checkCase(identity, {
        name: 'differs',
        code: 'log(2);',
        logs: [[1]],
        options: xfail,
      }),
    ).resolves.toBeUndefined();
  });
});

describe('harness: imports', { concurrent: false }, () => {
  it('supports default, named, namespace and combined imports', async () => {
    const logs = await logsOf(`
      import d, * as ns from 'silmaril/extra';
      import { value as v } from 'silmaril/extra';
      import e from 'silmaril/extra';
      log(d, ns.value, v, e);
    `);
    expect(logs).toEqual([['dflt', 7, 7, 'dflt']]);
  });

  it('supports several imports on one line', async () => {
    const logs = await logsOf(
      `import {value} from 'silmaril/extra';import {$$} from 'silmaril';log(value, typeof $$);`,
    );
    expect(logs).toEqual([[7, 'function']]);
  });

  it('does not touch import text inside strings', async () => {
    const logs = await logsOf("log(`\nimport x from 'silmaril'\n`);");
    expect(logs).toEqual([["\nimport x from 'silmaril'\n"]]);
  });

  it('lets a pipeline override silmaril/store', async () => {
    const logs = await logsOf("import S from 'silmaril/store'; log(S);", {
      ...identity,
      modules: { 'silmaril/store': { default: 'mine' } },
    });
    expect(logs).toEqual([['mine']]);
  });

  it('throws for export', async () => {
    await expect(logsOf('export const a = 1;')).rejects.toThrow('export');
  });

  it('throws for dynamic import()', async () => {
    await expect(logsOf("await import('silmaril');")).rejects.toThrow(
      'Dynamic import',
    );
  });
});
