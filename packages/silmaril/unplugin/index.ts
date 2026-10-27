import * as babel from '@babel/core';
import path from 'node:path';
import {
  createUnplugin,
  type FilterPattern,
  type SourceMapCompact,
  type UnpluginInstance,
} from 'unplugin';
import silmarilBabel from '../babel';

export interface SilmarilPluginFilter {
  include?: FilterPattern;
  exclude?: FilterPattern;
}

export interface SilmarilPluginOptions {
  filter?: SilmarilPluginFilter;
  babel?: babel.InputOptions;
}

type ParserPlugins = NonNullable<
  NonNullable<babel.InputOptions['parserOpts']>['plugins']
>;

const DEFAULT_INCLUDE = /\.[cm]?[jt]sx?$/i;
const TS_EXTENSION = /\.[cm]?tsx?$/i;

const silmaril: UnpluginInstance<SilmarilPluginOptions | undefined, false> =
  createUnplugin<SilmarilPluginOptions | undefined, false>((options = {}) => ({
    name: 'silmaril',
    transform: {
      filter: {
        id: {
          include: options.filter?.include ?? DEFAULT_INCLUDE,
          exclude: options.filter?.exclude,
        },
        // Only modules that import from `silmaril` need the compiler.
        code: 'silmaril',
      },
      async handler(code, id) {
        const parserPlugins: ParserPlugins = ['jsx'];
        if (TS_EXTENSION.test(id)) {
          parserPlugins.push('typescript');
        }
        const result = await babel.transformAsync(code, {
          ...options.babel,
          plugins: [[silmarilBabel, {}], ...(options.babel?.plugins ?? [])],
          parserOpts: {
            ...options.babel?.parserOpts,
            plugins: [
              ...(options.babel?.parserOpts?.plugins ?? []),
              ...parserPlugins,
            ],
          },
          filename: path.basename(id),
          ast: false,
          sourceMaps: true,
          configFile: false,
          babelrc: false,
          sourceFileName: id,
        });

        if (result) {
          return {
            code: result.code ?? '',
            // Babel's map is a valid source map, its type is only stricter.
            map: result.map as unknown as SourceMapCompact | null,
          };
        }
        return undefined;
      },
    },
  }));

export default silmaril;
