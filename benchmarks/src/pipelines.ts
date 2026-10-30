import { readdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import type { Pipeline } from '../../packages/silmaril/test/behavior/harness';

const PIPELINE_DIR = new URL(
  '../../packages/silmaril/test/behavior/pipelines/',
  import.meta.url,
);

/** Loads every pipeline file the behavior suite knows, in name order. */
export async function loadPipelines(): Promise<Pipeline[]> {
  const files = readdirSync(PIPELINE_DIR)
    .filter((file) => file.endsWith('.ts'))
    .toSorted();
  const result: Pipeline[] = [];
  for (const file of files) {
    const mod = (await import(
      pathToFileURL(new URL(file, PIPELINE_DIR).pathname).href
    )) as {
      default: Pipeline;
    };
    result.push(mod.default);
  }
  return result;
}
