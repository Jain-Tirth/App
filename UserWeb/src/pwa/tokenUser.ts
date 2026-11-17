/**
 * Reads the member id (`sub`) from an access token for use as a local-storage key only. The token
 * is not verified here; the server stays the authority and this value never grants anything.
 */
export function userIdFromAccessToken(token: string): string | null {
  const part = token.split('.')[1];
  if (!part) return null;
  try {
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded)) as { sub?: unknown };
    return typeof payload.sub === 'string' && payload.sub.length > 0 ? payload.sub : null;
  } catch {
    return null;
  }
}
