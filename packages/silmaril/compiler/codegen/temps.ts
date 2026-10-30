// Temp declarations, after the walk: one `let` per owner (runtime contract "Temps").
import { isFunctionNode } from '../analysis/scope';
import type { GenerateContext } from './context';

export function declareTemps(context: GenerateContext): void {
  const { s, code } = context;
  for (const [owner, list] of context.temps) {
    const names: string[] = [];
    for (const name of list) {
      if (!context.declaredTemps.has(name)) {
        names.push(name);
      }
    }
    if (names.length === 0) {
      continue;
    }
    const declaration = `let ${names.join(', ')};`;

    // A class field initializer: an arrow called at once keeps `this` and declares
    // the temps. It wraps the edits made inside the value.
    if (!isFunctionNode(owner)) {
      const value = owner.value!;
      s.prependLeft(value.start, `(() => { ${declaration} return `);
      s.appendRight(value.end, '; })()');
      continue;
    }

    const body = owner.body!;
    if (body.type !== 'BlockStatement') {
      // `(a) => expr` -> `(a) => { let ...; return expr; }`. These wrap the edits
      // made earlier at the same offsets, so they go on the outside.
      s.prependLeft(body.start, `{ ${declaration} return `);
      s.appendRight(body.end, '; }');
      continue;
    }

    // At the start of the body, after its directives, on a line of its own.
    let at = body.start + 1;
    for (const statement of body.body) {
      if (statement.type === 'ExpressionStatement' && statement.directive) {
        at = statement.end;
      } else {
        break;
      }
    }
    const next = body.body[0];
    let indent = '';
    if (next) {
      const lineStart = code.lastIndexOf('\n', next.start - 1) + 1;
      indent = /^[ \t]*/.exec(code.slice(lineStart, next.start))![0];
    }
    s.appendLeft(at, `\n${indent}${declaration}`);
  }
}
