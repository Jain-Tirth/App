/**
 * Minimal client contract that may cross a transaction boundary. `pg`'s
 * `PoolClient` satisfies it structurally, so application and domain code can
 * accept a transactional client without importing the database driver.
 */
export interface DatabaseClient {
  query(sql: string, params?: any[]): Promise<{ rows: any[] }>;
}
