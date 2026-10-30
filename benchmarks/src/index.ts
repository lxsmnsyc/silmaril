import { benchCompile } from './compile';
import { loadPipelines } from './pipelines';
import { benchUpdate } from './update';

const pipelines = await loadPipelines();
console.log(`node ${process.version}, ${process.platform} ${process.arch}`);
console.log(
  `pipelines: ${pipelines.map((pipeline) => pipeline.name).join(', ')}`,
);
await benchCompile(pipelines);
await benchUpdate(pipelines);
