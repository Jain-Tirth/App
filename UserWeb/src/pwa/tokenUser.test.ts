import { describe, expect, it } from 'vitest';
import { userIdFromAccessToken } from './tokenUser';

function token(payload: unknown): string {
  const body = btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `eyJhbGciOiJIUzI1NiJ9.${body}.signature`;
}

describe('userIdFromAccessToken', () => {
  it('reads the sub claim', () => {
    expect(userIdFromAccessToken(token({ sub: 'user-123', role: 'user' }))).toBe('user-123');
  });
  it('returns null for malformed tokens', () => {
    expect(userIdFromAccessToken('nonsense')).toBeNull();
    expect(userIdFromAccessToken('a.%%%.c')).toBeNull();
    expect(userIdFromAccessToken(token({ role: 'user' }))).toBeNull();
  });
});
