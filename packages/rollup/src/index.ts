import type { Plugin } from 'rollup';
import type { SilmarilPluginOptions } from 'unplugin-silmaril';
import silmarilUnplugin from 'unplugin-silmaril';

const silmarilPlugin = silmarilUnplugin.rollup as (
  options: SilmarilPluginOptions,
) => Plugin;

export type {
  SilmarilPluginFilter,
  SilmarilPluginOptions,
} from 'unplugin-silmaril';

export default silmarilPlugin;
