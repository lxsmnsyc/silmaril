/**
 * @deprecated Use `silmaril/unplugin` instead:
 * `import silmaril from 'silmaril/unplugin'; silmaril.rollup(options)`.
 */
import silmaril from 'silmaril/unplugin';
import type { Plugin } from 'rollup';
import type { SilmarilPluginOptions } from 'silmaril/unplugin';

export type {
  SilmarilPluginFilter,
  SilmarilPluginOptions,
} from 'silmaril/unplugin';

/**
 * @deprecated Use `silmaril.rollup` from `silmaril/unplugin` instead.
 */
export default function silmarilPlugin(
  options: SilmarilPluginOptions = {},
): Plugin {
  return silmaril.rollup(options) as Plugin;
}
