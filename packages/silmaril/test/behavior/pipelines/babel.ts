import * as babel from '@babel/core';
import plugin from '../../../babel';
import * as runtime from '../../../src';
import type { Pipeline } from '../harness';

const pipeline: Pipeline = {
  name: 'babel',
  compile(code, filename) {
    const result = babel.transformSync(code, {
      filename,
      babelrc: false,
      configFile: false,
      plugins: [plugin],
    });
    if (!result?.code) {
      throw new Error(`Babel produced no output for ${filename}`);
    }
    return result.code;
  },
  runtime,
};

export default pipeline;
