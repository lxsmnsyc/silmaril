import * as babel from '@babel/core';
import path from 'node:path';
import plugin from './plugin';
import type { CodeOutput } from './types';
import assert from './utils/assert';

export type {
  CodeOutput,
  DefaultImportDefinition,
  ImportDefinition,
  NamedImportDefinition,
} from './types';

export async function compile(id: string, code: string): Promise<CodeOutput> {
  const parsedPath = path.parse(id);

  const plugins: babel.ParserOptions['plugins'] = ['jsx'];

  if (/\.[mc]?tsx?$/i.test(id)) {
    plugins.push('typescript');
  }

  const result = await babel.transformAsync(code, {
    plugins: [[plugin]],
    parserOpts: {
      plugins,
    },
    filename: parsedPath.base,
    ast: false,
    sourceFileName: id,
    sourceMaps: true,
    configFile: false,
    babelrc: false,
  });

  assert(result, 'invariant');

  return {
    code: result.code,
    map: result.map,
  };
}
