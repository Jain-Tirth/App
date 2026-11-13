/**
 * The only module in the web app that reads `import.meta.env`.
 *
 * Vite inlines `VITE_*` values at build time, so this validates once at startup
 * and throws when a required value is missing or malformed. There is no
 * fallback URL: the API base is always an explicit setting.
 */

export interface Env {
  /** Absolute API base such as `http://localhost:3000/api/v1`, no trailing slash. */
  readonly apiBaseUrl: string;
}

export function parseEnv(raw: Record<string, unknown>): Env {
  const value = raw.VITE_BASE_URL;

  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error('Invalid environment: VITE_BASE_URL is required (e.g. http://localhost:3000/api/v1).');
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

  return { apiBaseUrl: url.toString().replace(/\/+$/, '') };
}

export const env: Env = parseEnv(import.meta.env);
