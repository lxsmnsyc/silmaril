import fs from 'node:fs/promises';
import path from 'node:path';
import { compile } from 'silmaril/babel';

const target = path.join(process.cwd(), 'input.js');
const result = await compile(target, await fs.readFile(target, 'utf-8'));

await fs.writeFile(path.join(process.cwd(), 'output.js'), result.code);
