import type { FilterPattern } from '@rollup/pluginutils';
import { createFilter } from '@rollup/pluginutils';
import { compile } from 'silmaril/compiler';
import { createUnplugin } from 'unplugin';

export interface SilmarilPluginFilter {
  include?: FilterPattern;
  exclude?: FilterPattern;
}

export interface SilmarilPluginOptions {
  filter?: SilmarilPluginFilter;
}

const DEFAULT_INCLUDE = 'src/**/*.{jsx,tsx,ts,js,mjs,cjs}';
const DEFAULT_EXCLUDE = 'node_modules/**/*.{jsx,tsx,ts,js,mjs,cjs}';

const silmarilUnplugin = createUnplugin((options: SilmarilPluginOptions) => {
  const filter = createFilter(
    options.filter?.include || DEFAULT_INCLUDE,
    options.filter?.exclude || DEFAULT_EXCLUDE,
  );

  return {
    name: 'silmaril',
    vite: {
      enforce: 'pre',
    },
    transformInclude(id) {
      return filter(id);
    },
    async transform(code, id) {
      const result = await compile(id, code);
      return {
        code: result.code || '',
        map: result.map,
      };
    },
  };
});

export default silmarilUnplugin;
