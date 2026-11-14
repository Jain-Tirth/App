/**
 * The only module in the admin panel that reads `import.meta.env`.
 *
 * Vite inlines `VITE_*` values at build time, so this validates once at startup
 * and throws when the value is missing or malformed. There is no fallback URL.
 */

export interface Env {
  /** Absolute API base ending in `/api/v1`, no trailing slash. */
  readonly apiBaseUrl: string;
}

const API_PREFIX = '/api/v1';

/**
 * Accepts either the API origin (`http://localhost:3000`) or the full base
 * (`http://localhost:3000/api/v1`) and returns the full base.
 */
export function parseEnv(raw: Record<string, unknown>): Env {
  const value = raw.VITE_BASE_URL;

  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error('Invalid environment: VITE_BASE_URL is required (e.g. http://localhost:3000).');
  }

  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error(`Invalid environment: VITE_BASE_URL "${value}" is not an absolute URL.`);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Invalid environment: VITE_BASE_URL must use http or https, got "${url.protocol}".`);
  }

  const base = url.toString().replace(/\/+$/, '');
  return { apiBaseUrl: base.endsWith(API_PREFIX) ? base : `${base}${API_PREFIX}` };
}

export const env: Env = parseEnv(import.meta.env);
