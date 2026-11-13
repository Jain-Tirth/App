import { describe, expect, it } from 'vitest';
import { parseEnv } from './env';

describe('parseEnv', () => {
  it('accepts an absolute http URL and drops a trailing slash', () => {
    expect(parseEnv({ VITE_BASE_URL: 'http://localhost:3000/api/v1/' }).apiBaseUrl).toBe(
      'http://localhost:3000/api/v1',
    );
  });

  it('accepts https', () => {
    expect(parseEnv({ VITE_BASE_URL: 'https://api.example.com/api/v1' }).apiBaseUrl).toBe(
      'https://api.example.com/api/v1',
    );
  });

  it.each([
    ['missing', {}],
    ['empty', { VITE_BASE_URL: '' }],
    ['blank', { VITE_BASE_URL: '   ' }],
    ['not a string', { VITE_BASE_URL: 3000 }],
  ])('refuses to start when VITE_BASE_URL is %s', (_label, raw) => {
    expect(() => parseEnv(raw)).toThrow('VITE_BASE_URL is required');
  });

  it('refuses a relative or malformed URL', () => {
    expect(() => parseEnv({ VITE_BASE_URL: '/api/v1' })).toThrow('not an absolute URL');
    expect(() => parseEnv({ VITE_BASE_URL: 'localhost:3000' })).toThrow('http or https');
  });

  it('refuses a non-http protocol', () => {
    expect(() => parseEnv({ VITE_BASE_URL: 'ftp://localhost/api' })).toThrow('http or https');
  });
});
