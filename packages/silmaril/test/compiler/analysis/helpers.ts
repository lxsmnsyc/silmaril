import { readFileSync } from 'node:fs';
import { analyzeModule } from '../../../compiler/analysis/index';
import type { ModuleModel } from '../../../compiler/analysis/model';
import {
  analyzeScopes,
  type Reference,
  type ScopeInfo,
} from '../../../compiler/analysis/scope';
import { parseModule, type ParsedModule } from '../../../compiler/source';

export const tricky: string = readFileSync(
  new URL('./fixtures/tricky.tsx.txt', import.meta.url),
  'utf8',
);

export interface Analyzed {
  parsed: ParsedModule;
  info: ScopeInfo;
}

export function analyze(code: string, filename = 'a.ts'): Analyzed {
  const parsed = parseModule(code, filename);
  return { parsed, info: analyzeScopes(parsed.program) };
}

export function model(code: string, filename = 'a.js'): ModuleModel {
  const result = analyzeModule(code, filename);
  if (!result) {
    throw new Error('no compile-time import');
  }
  return result;
}

export function refsNamed(info: ScopeInfo, name: string): Reference[] {
  const out: Reference[] = [];
  for (const ref of info.references) {
    if (ref.identifier.name === name) {
      out.push(ref);
    }
  }
  return out;
}

// A TSX module of about `lines` lines, made of silmaril setups.
function block(i: number): string {
  return `
interface Props${i} {
  start: number;
  label: string;
}

export const Counter${i} = $composable((props: Props${i}) => {
  let count = props.start;
  let step = 1;
  let history: number[] = [];
  const doubled = count * 2;
  const label = \`\${props.label}: \${count}\`;
  let [low, high] = [count - 1, count + 1];

  function increment(amount = step) {
    count += amount;
    history = [...history, count];
    low++;
    [low, high] = [high, low];
  }

  function reset() {
    let count = 0;
    count += 1;
    step = count as number;
    return count;
  }

  $(console.log(label, doubled, history.length));
  $sync(() => {
    if (count > ${i}) {
      high = count!;
    }
  });
  onMount(() => {
    const view = (
      <div class="counter" onClick={() => increment()}>
        <Display value={count} label={label} />
        {history.map((item) => <span key={item}>{item}</span>)}
      </div>
    );
    return () => view;
  });
  return { increment, reset };
});
`;
}

export function generateModule(lines: number): string {
  let code = `import { $composable, $, $sync, onMount } from 'silmaril';\nimport { Display } from './display';\n`;
  let i = 0;
  while (code.split('\n').length < lines) {
    code += block(i);
    i += 1;
  }
  return code;
}
