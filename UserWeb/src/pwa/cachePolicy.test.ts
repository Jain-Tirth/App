import { describe, expect, it } from 'vitest';
import { decideCache } from './cachePolicy';

const ORIGIN = 'https://app.example.test';

function decide(path: string, extra: Partial<{ method: string; hasAuthorization: boolean; origin: string }> = {}) {
  const url = path.startsWith('http') ? path : `${ORIGIN}${path}`;
  return decideCache({
    url,
    method: extra.method ?? 'GET',
    origin: extra.origin ?? ORIGIN,
    hasAuthorization: extra.hasAuthorization ?? false,
  });
}

describe('decideCache', () => {
  it.each(['/', '/index.html', '/assets/index-abc123.js', '/assets/index-abc123.css', '/site.webmanifest', '/android-chrome-192x192.png', '/favicon.ico'])(
    'caches same-origin static %s',
    (path) => {
      expect(decide(path)).toEqual({ cacheable: true });
    },
  );

  it('never caches anything under /api/', () => {
    expect(decide('/api/v1/profiles/me')).toEqual({ cacheable: false, reason: 'api' });
    expect(decide('/api/v1/logo.png')).toEqual({ cacheable: false, reason: 'api' });
  });

  it.each(['?X-Amz-Signature=abc', '?signature=abc', '?Expires=1', '?token=t', '?x-amz-credential=c', '?X-Goog-Signature=s'])(
    'never caches a signed URL (%s)',
    (query) => {
      expect(decide(`/assets/photo.jpg${query}`)).toEqual({ cacheable: false, reason: 'signed-url' });
    },
  );

  it('never caches a request carrying an Authorization header', () => {
    expect(decide('/assets/index-abc123.js', { hasAuthorization: true })).toEqual({
      cacheable: false,
      reason: 'authorization',
    });
  });

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('never caches %s', (method) => {
    expect(decide('/assets/index-abc123.js', { method })).toEqual({ cacheable: false, reason: 'non-get' });
  });

  it('never caches cross-origin responses, including Google Fonts', () => {
    expect(decide('https://fonts.googleapis.com/css2?family=National+Park')).toEqual({
      cacheable: false,
      reason: 'cross-origin',
    });
    expect(decide('https://fonts.gstatic.com/s/x/font.woff2')).toEqual({ cacheable: false, reason: 'cross-origin' });
    expect(decide('https://other.example.test/assets/a.js')).toEqual({ cacheable: false, reason: 'cross-origin' });
  });

  it('does not cache app routes or the service worker script itself', () => {
    expect(decide('/login')).toEqual({ cacheable: false, reason: 'not-static' });
    expect(decide('/profile/abc')).toEqual({ cacheable: false, reason: 'not-static' });
    expect(decide('/sw.js')).toEqual({ cacheable: false, reason: 'not-static' });
  });

  it('rejects an unparsable URL', () => {
    expect(decideCache({ url: 'not a url', method: 'GET', origin: ORIGIN, hasAuthorization: false })).toEqual({
      cacheable: false,
      reason: 'invalid-url',
    });
  });
});
