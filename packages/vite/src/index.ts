import type { SilmarilPluginOptions } from 'unplugin-silmaril';
import silmarilUnplugin from 'unplugin-silmaril';
import type { Plugin } from 'vite';

const silmarilPlugin = silmarilUnplugin.vite as (
  options: SilmarilPluginOptions,
) => Plugin;

export type {
  SilmarilPluginFilter,
  SilmarilPluginOptions,
} from 'unplugin-silmaril';

export default silmarilPlugin;
