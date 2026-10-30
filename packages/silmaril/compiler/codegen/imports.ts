// The import rewrite and the graph constants, after the walk (runtime contract
// "Imports" and "Graph format").
import type { Node } from 'oxc-parser';
import { HELPERS, type GenerateContext } from './context';

/**
 * Removes the compile-time names from every named `'silmaril'` import and adds the
 * helpers to the first one, in export-table order.
 */
export function rewriteImports(context: GenerateContext): void {
  const { s, code, model } = context;
  const helpers: string[] = [];
  for (const name of HELPERS) {
    if (context.usedHelpers.has(name)) {
      const local = context.helperNames.get(name)!;
      helpers.push(local === name ? name : `${name} as ${local}`);
    }
  }

  let first = true;
  for (const declaration of model.imports.declarations) {
    const kept: string[] = [];
    let defaultText = '';
    for (const specifier of declaration.specifiers) {
      if (specifier.type === 'ImportDefaultSpecifier') {
        defaultText = `${code.slice(specifier.start, specifier.end)}, `;
      } else if (
        specifier.type === 'ImportSpecifier' &&
        !model.imports.compileTime.has(specifier)
      ) {
        kept.push(code.slice(specifier.start, specifier.end));
      }
    }
    const names = first ? [...helpers, ...kept] : kept;
    first = false;
    const source = code.slice(declaration.source.start, declaration.source.end);
    let text = '';
    if (names.length > 0) {
      text = `import ${defaultText}{ ${names.join(', ')} } from ${source};`;
    } else if (defaultText !== '') {
      text = `import ${defaultText.slice(0, -2)} from ${source};`;
    }
    s.update(declaration.start, declaration.end, text);
  }
}

// `[[0], [], [[1, 0]]]` with the spacing of the fixtures.
function printGraph(lists: unknown[]): string {
  return JSON.stringify(lists).replaceAll(',', ', ');
}

/** One module-level constant per graph, after the last import. */
export function emitGraphs(context: GenerateContext): void {
  const { s, model } = context;
  const graphs: string[] = [];
  for (const scope of model.scopes) {
    if (!scope.graph) {
      continue;
    }
    // Trailing slots that no entry reads are left out.
    const lists = [...scope.graph];
    while (lists.length > 0 && lists.at(-1)!.length === 0) {
      lists.pop();
    }
    graphs.push(`const ${scope.graphName} = ${printGraph(lists)};`);
  }
  if (graphs.length === 0) {
    return;
  }

  let lastImport: Node | null = null;
  for (const statement of model.parsed.program.body) {
    if (statement.type === 'ImportDeclaration') {
      lastImport = statement;
    }
  }
  const text = graphs.join('\n\n');
  if (lastImport) {
    s.appendLeft(lastImport.end, `\n\n${text}`);
  } else {
    s.prepend(`${text}\n\n`);
  }
}
