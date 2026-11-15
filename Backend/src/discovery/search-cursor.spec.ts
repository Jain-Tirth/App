import { ApiException } from '../common/api-error';
import { decodeCursor, encodeCursor } from './search-cursor';

const POSITION = {
  createdAt: '2026-11-14T10:00:00.123456',
  profileRef: 'a'.repeat(32),
};

function invalidCursorOf(raw: string): ApiException {
  try {
    decodeCursor(raw);
  } catch (error) {
    return error as ApiException;
  }

  throw new Error('expected decodeCursor to throw');
}

describe('search cursor', () => {
  it('round-trips a position', () => {
    expect(decodeCursor(encodeCursor(POSITION))).toEqual(POSITION);
  });

  it('is URL safe', () => {
    expect(encodeCursor(POSITION)).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it.each([
    ['not base64 at all', '!!!not-a-cursor!!!'],
    ['base64 of non-JSON', Buffer.from('hello').toString('base64url')],
    ['JSON of the wrong shape', Buffer.from('{"x":1}').toString('base64url')],
    [
      'a timestamp that is not a date',
      Buffer.from(
        JSON.stringify({ t: '2026-13-45T10:00:00.123456', r: 'a'.repeat(32) }),
      ).toString('base64url'),
    ],
    [
      'a reference of the wrong form',
      Buffer.from(
        JSON.stringify({ t: '2026-11-14T10:00:00.123456', r: "x'; DROP" }),
      ).toString('base64url'),
    ],
    ['a tampered tail', `${encodeCursor(POSITION)}AA`],
  ])('rejects %s with 400 INVALID_CURSOR', (_label, raw) => {
    const error = invalidCursorOf(raw);

    expect(error.status).toBe(400);
    expect(error.code).toBe('INVALID_CURSOR');
  });
});
