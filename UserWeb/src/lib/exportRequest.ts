/**
 * The member's latest export request id, kept in localStorage under a key that
 * includes the user id. It is dropped after 24 hours (the server's expiry) and
 * at logout. Only the id and the request time are stored; never the password.
 */
const PREFIX = 'user_export_request:';
export const EXPORT_TTL_MS = 24 * 60 * 60 * 1000;

interface Stored {
  requestId: string;
  requestedAt: number;
}

export function exportKey(userId: string): string {
  return `${PREFIX}${userId}`;
}

export function saveExportRequest(userId: string, requestId: string, now = Date.now()): void {
  const value: Stored = { requestId, requestedAt: now };
  localStorage.setItem(exportKey(userId), JSON.stringify(value));
}

export function clearExportRequest(userId: string): void {
  localStorage.removeItem(exportKey(userId));
}

/** Every member's stored id, called at logout. */
export function clearAllExportRequests(): void {
  const keys: string[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key && key.startsWith(PREFIX)) keys.push(key);
  }
  keys.forEach((key) => localStorage.removeItem(key));
}

/** The stored request id, or null when none, unreadable or older than 24 hours. */
export function readExportRequest(userId: string, now = Date.now()): Stored | null {
  const raw = localStorage.getItem(exportKey(userId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<Stored>;
    if (
      typeof parsed.requestId === 'string' &&
      typeof parsed.requestedAt === 'number' &&
      now - parsed.requestedAt < EXPORT_TTL_MS
    ) {
      return { requestId: parsed.requestId, requestedAt: parsed.requestedAt };
    }
  } catch {
    // fall through and discard
  }
  clearExportRequest(userId);
  return null;
}
