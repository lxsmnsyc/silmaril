/**
 * @deprecated Use `silmaril/unplugin` instead:
 * `import silmaril from 'silmaril/unplugin'; silmaril.vite(options)`.
 */
import silmaril from 'silmaril/unplugin';
import type { Plugin } from 'vite';
import type { SilmarilPluginOptions } from 'silmaril/unplugin';

export type {
  SilmarilPluginFilter,
  SilmarilPluginOptions,
} from 'silmaril/unplugin';

/**
 * @deprecated Use `silmaril.vite` from `silmaril/unplugin` instead.
 */
export default function silmarilPlugin(
  options: SilmarilPluginOptions = {},
): Plugin {
  return silmaril.vite(options) as Plugin;
}
