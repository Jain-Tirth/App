/**
 * Which requests the service worker may store. Pure: no globals, so the service worker bundle and
 * the unit tests share the exact same rule. The default answer is "do not cache".
 */

export interface CacheRequestInfo {
  /** Absolute request URL. */
  url: string;
  method: string;
  /** Origin of the app (self.location.origin). */
  origin: string;
  /** True when the request carries an Authorization header. */
  hasAuthorization: boolean;
}

export type CacheDecision =
  | { cacheable: true }
  | {
      cacheable: false;
      reason:
        | 'invalid-url'
        | 'non-get'
        | 'authorization'
        | 'cross-origin'
        | 'api'
        | 'signed-url'
        | 'not-static';
    };

/** Query parameter names (lower case) that mark a signed or token-bearing URL. */
const SIGNATURE_PARAMS = new Set([
  'signature',
  'sig',
  'token',
  'access_token',
  'expires',
  'x-amz-signature',
  'x-amz-credential',
  'x-amz-security-token',
  'x-goog-signature',
  'x-goog-credential',
  'se',
  'sv',
]);

const STATIC_EXTENSIONS = new Set([
  'js',
  'css',
  'png',
  'jpg',
  'jpeg',
  'webp',
  'svg',
  'ico',
  'woff',
  'woff2',
  'webmanifest',
]);

const SHELL_PATHS = new Set(['/', '/index.html']);

function hasSignatureParam(params: URLSearchParams): boolean {
  for (const name of params.keys()) {
    const lower = name.toLowerCase();
    if (SIGNATURE_PARAMS.has(lower) || lower.startsWith('x-amz-') || lower.startsWith('x-goog-')) {
      return true;
    }
  }
  return false;
}

function isStaticPath(pathname: string): boolean {
  if (SHELL_PATHS.has(pathname)) return true;
  if (pathname === '/sw.js') return false;
  if (pathname.startsWith('/assets/')) return true;
  const last = pathname.split('/').pop() ?? '';
  const dot = last.lastIndexOf('.');
  return dot > 0 && STATIC_EXTENSIONS.has(last.slice(dot + 1).toLowerCase());
}

export function decideCache(request: CacheRequestInfo): CacheDecision {
  let url: URL;
  try {
    url = new URL(request.url);
  } catch {
    return { cacheable: false, reason: 'invalid-url' };
  }
  if (request.method.toUpperCase() !== 'GET') return { cacheable: false, reason: 'non-get' };
  if (request.hasAuthorization) return { cacheable: false, reason: 'authorization' };
  // Cross-origin responses (Google Fonts, API on another origin, signed media hosts) are never stored.
  if (url.origin !== request.origin) return { cacheable: false, reason: 'cross-origin' };
  if (url.pathname === '/api' || url.pathname.startsWith('/api/') || url.pathname.includes('/api/')) {
    return { cacheable: false, reason: 'api' };
  }
  if (hasSignatureParam(url.searchParams)) return { cacheable: false, reason: 'signed-url' };
  if (!isStaticPath(url.pathname)) return { cacheable: false, reason: 'not-static' };
  return { cacheable: true };
}

/** Prefix of the only cache the app owns; a bumped build id yields a new cache name. */
export const SHELL_CACHE_PREFIX = 'dhobi-shell-';
