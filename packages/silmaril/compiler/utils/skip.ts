import type * as t from '@babel/types';

const CAN_SKIP = /^\s*\$skip\s*$/;

export function canSkip(node: t.Node): boolean {
  if (node.leadingComments) {
    for (let i = 0, len = node.leadingComments.length; i < len; i += 1) {
      if (CAN_SKIP.test(node.leadingComments[i].value)) {
        return true;
      }
    }
  }
  return false;
}
