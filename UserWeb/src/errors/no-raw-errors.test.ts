import { describe, expect, it } from 'vitest';

/**
 * Error-message policy guard: no screen may render a raw error. Everything a
 * member sees must come from errors/messages.ts. This scans the source text.
 */

/** Raw text of every non-test source file under src, keyed by its path relative to this folder. */
const SOURCES = import.meta.glob<string>(['../**/*.{ts,tsx}', '!../**/*.test.{ts,tsx}'], {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** Turns a glob key ("../pages/X.tsx" or "./messages.ts") into a path relative to src. */
function srcPath(key: string): string {
  return key.startsWith('../') ? key.slice(3) : `errors/${key.slice(2)}`;
}

/** Files allowed to touch raw error internals. */
const EXEMPT = new Set(['errors/messages.ts', 'api.ts', 'apiError.ts']);

interface Rule {
  name: string;
  pattern: RegExp;
}

const RULES: Rule[] = [
  { name: 'err.message / error.message / e.message', pattern: /\b(?:err|error|e|ex|exception|cause)\.message\b/ },
  { name: '.message inside JSX braces', pattern: /\.message\s*\}/ },
  { name: 'JSON.stringify of an error or response', pattern: /JSON\.stringify\(\s*(?:err|error|e|ex|response|res)\b/ },
  { name: 'response.text() / res.text()', pattern: /\b(?:response|res)\.text\(\)/ },
  { name: 'String(err)', pattern: /String\(\s*(?:err|error|e|ex)\s*\)/ },
  { name: '${err} template', pattern: /\$\{\s*(?:err|error|e|ex)\s*\}/ },
];

export function findViolations(source: string): string[] {
  return RULES.filter((rule) => rule.pattern.test(source)).map((rule) => rule.name);
}

/** Catch blocks that set error state without first calling the mapper. */
export function findUnmappedCatchBlocks(source: string): number {
  let count = 0;
  const catchStart = /catch\s*\(\s*(\w+)\s*\)\s*\{/g;
  let match: RegExpExecArray | null;
  while ((match = catchStart.exec(source)) !== null) {
    let depth = 1;
    let index = catchStart.lastIndex;
    while (index < source.length && depth > 0) {
      if (source[index] === '{') depth += 1;
      if (source[index] === '}') depth -= 1;
      index += 1;
    }
    const body = source.slice(catchStart.lastIndex, index - 1);
    const setsError = /set\w*Error\w*\(/.test(body);
    const mapped = /describeError\(|showError\(|describeCode\(/.test(body);
    if (setsError && !mapped) count += 1;
  }
  return count;
}

describe('matcher self-check', () => {
  it.each([
    ['err.message', 'setError(err.message)'],
    ['error.message', 'x = error.message'],
    ['e.message', 'toast(e.message)'],
    ['JSX message', '<p>{state.message}</p>'],
    ['JSON.stringify(err)', 'JSON.stringify(err)'],
    ['JSON.stringify(response)', 'JSON.stringify(response, null, 2)'],
    ['response.text()', 'const t = await response.text();'],
    ['res.text()', 'await res.text()'],
    ['String(err)', 'setError(String(err))'],
    ['template err', 'setError(`Failed: ${err}`)'],
  ])('flags %s', (_name, snippet) => {
    expect(findViolations(snippet).length).toBeGreaterThan(0);
  });

  it('flags a deliberately bad fixture and passes a clean one', () => {
    const bad = `try { await go(); } catch (err) { setError(err instanceof Error ? err.message : 'x'); }`;
    expect(findViolations(bad)).toContain('err.message / error.message / e.message');
    const good = `try { await go(); } catch (err) { setError(describeError(err, 'login').message); }`;
    expect(findViolations(good)).toEqual([]);
  });

  it('flags a catch block that sets error state without the mapper', () => {
    expect(findUnmappedCatchBlocks(`try {} catch (err) { setError('Login failed'); }`)).toBe(1);
    expect(
      findUnmappedCatchBlocks(`try {} catch (err) { setError(describeError(err, 'login').message); }`),
    ).toBe(0);
    expect(findUnmappedCatchBlocks(`try {} catch { setError('x'); }`)).toBe(0);
  });
});

describe('UserWeb sources render no raw errors', () => {
  const files = Object.entries(SOURCES)
    .map(([key, source]): [string, string] => [srcPath(key), source])
    .filter(([name]) => !EXEMPT.has(name));

  it('scans a meaningful set of files', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it('covers pages, components and lib, and leaves out the exempt files and tests', () => {
    const names = files.map(([name]) => name);
    expect(names).toContain('pages/ProfileDetailPage.tsx');
    expect(names).toContain('components/DiscoverySection.tsx');
    expect(names).toContain('lib/discovery.ts');
    expect(Object.keys(SOURCES).map(srcPath)).toContain('errors/messages.ts');
    expect(names).not.toContain('errors/messages.ts');
    expect(names).not.toContain('lib/discovery.test.ts');
    expect(names).not.toContain('api.ts');
  });

  it.each(files)('%s', (_name, source) => {
    expect(findViolations(source)).toEqual([]);
    expect(findUnmappedCatchBlocks(source)).toBe(0);
  });
});
