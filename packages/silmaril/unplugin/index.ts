import {
  createUnplugin,
  type FilterPattern,
  type UnpluginInstance,
} from 'unplugin';
import { compile } from '../compiler';

export interface SilmarilPluginFilter {
  include?: FilterPattern;
  exclude?: FilterPattern;
}

export interface SilmarilPluginOptions {
  filter?: SilmarilPluginFilter;
}

const DEFAULT_INCLUDE = /\.[cm]?[jt]sx?$/i;

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
      handler(code, id) {
        // The compiler picks the language from the extension, so drop a query such as `?v=1`.
        const result = compile(code, { filename: id.split('?')[0]! });
        if (!result.map) {
          // No compile-time name is imported: the module is unchanged.
          return undefined;
        }
        return { code: result.code, map: result.map };
      },
    },
  }));

export default silmaril;
