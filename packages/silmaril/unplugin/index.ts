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

const SCRIPT_EXTENSION = /\.[cm]?[jt]sx?$/i;

/**
 * The file name the compiler gets. The compiler picks the language from its extension.
 * A query such as `?v=1` is dropped. A sub-module id such as `/a.vue?vue&lang.ts` keeps
 * the language that ends the id: it becomes `/a.vue.ts`.
 */
function getFilename(id: string): string {
  const path = id.split('?')[0]!;
  if (SCRIPT_EXTENSION.test(path)) {
    return path;
  }
  const match = SCRIPT_EXTENSION.exec(id);
  return match ? path + match[0] : path;
}

const silmaril: UnpluginInstance<SilmarilPluginOptions | undefined, false> =
  createUnplugin<SilmarilPluginOptions | undefined, false>((options = {}) => ({
    name: 'silmaril',
    transform: {
      filter: {
        id: {
          include: options.filter?.include ?? SCRIPT_EXTENSION,
          exclude: options.filter?.exclude,
        },
        // Only modules that import from `silmaril` need the compiler.
        code: 'silmaril',
      },
      handler(code, id) {
        const result = compile(code, { filename: getFilename(id) });
        if (!result.map) {
          // No compile-time name is imported: the module is unchanged.
          return undefined;
        }
        return { code: result.code, map: result.map };
      },
    },
  }));

export default silmaril;
