import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '..');

/** Files that make up the reopen call. None may render `.message` of a caught value. */
const REOPEN_FILES = ['components/ReopenDialog.tsx', 'errors/messages.ts', 'errors/adminApiError.ts'];

describe('reopen call renders no raw errors', () => {
  it.each(REOPEN_FILES)('%s never reads or renders .message of a caught value', (file) => {
    const source = readFileSync(join(SRC, file), 'utf8').replace(/super\('[^']*'\)/g, '');
    expect(source).not.toMatch(/\b(?:err|error|e|ex|cause)\.message\b/);
    expect(source).not.toMatch(/\.message\s*\}/);
  });

  it('ReopenDialog maps the caught value with describeReopenError', () => {
    const source = readFileSync(join(SRC, 'components/ReopenDialog.tsx'), 'utf8');
    expect(source).toContain('describeReopenError(');
  });
});
