// Generates a TSX module of about `lines` lines, made of silmaril setups.
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

export function generate(lines: number): string {
  let code = `import { $composable, $, $sync, onMount } from 'silmaril';\nimport { Display } from './display';\n`;
  let i = 0;
  while (code.split('\n').length < lines) {
    code += block(i);
    i += 1;
  }
  return code;
}
