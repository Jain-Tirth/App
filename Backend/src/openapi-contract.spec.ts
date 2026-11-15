import { readFileSync } from 'fs';
import { join } from 'path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const yaml = require('js-yaml');

describe('openapi.yaml', () => {
  const text = readFileSync(join(__dirname, '..', 'openapi.yaml'), 'utf8');

  it('parses as valid YAML', () => {
    expect(() => yaml.load(text)).not.toThrow();
  });

  it('documents the discovery paths', () => {
    const doc = yaml.load(text) as { paths: Record<string, unknown> };
    const paths = Object.keys(doc.paths).filter((p) => /discover|search|profiles/i.test(p));
    expect(paths.length).toBeGreaterThanOrEqual(3);
  });
});
