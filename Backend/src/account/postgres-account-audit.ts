import type { DatabaseClient } from '../database/database.types';
import type { AccountAuditEvent, AuditContext } from './account.types';

export interface AccountAuditEntry {
  /** Null only for the purge's own row: the member is gone by then. */
  userId: string | null;
  eventType: AccountAuditEvent;
  requestId?: string | null;
  context: AuditContext;
}

/**
 * Appends one row to "AccountAuditLog" on the caller's client, so the row
 * commits or rolls back together with the action it records.
 */
export async function recordAccountAudit(
  client: DatabaseClient,
  entry: AccountAuditEntry,
): Promise<void> {
  await client.query(
    `INSERT INTO "AccountAuditLog" ("userId", "eventType", "requestId", "ip", "userAgent")
     VALUES ($1, $2, $3, $4, $5)`,
    [
      entry.userId,
      entry.eventType,
      entry.requestId ?? null,
      entry.context.ip,
      entry.context.userAgent,
    ],
  );
}
