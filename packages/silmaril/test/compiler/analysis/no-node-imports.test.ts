// compiler/ must run in the browser through the wasm binding of oxc-parser, so no file
// under it may import a `node:` module.
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = new URL('../../../compiler/', import.meta.url);

function listFiles(dir: URL): URL[] {
  const files: URL[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      files.push(...listFiles(new URL(`${entry.name}/`, dir)));
    } else if (/\.[cm]?[jt]sx?$/.test(entry.name)) {
      files.push(new URL(entry.name, dir));
    }
  }
  return files;
}

describe('compiler/', () => {
  const files = listFiles(root);

  it('has files', () => {
    expect(files.length).toBeGreaterThan(5);
  });

  for (const file of files) {
    it(`${file.pathname.slice(root.pathname.length)} imports no node: module and no @babel package`, () => {
      const text = readFileSync(file, 'utf8');
      expect(text).not.toMatch(/from\s*['"]node:/);
      expect(text).not.toMatch(/import\(\s*['"]node:/);
      expect(text).not.toMatch(/['"]@babel\//);
    });
  }
});
