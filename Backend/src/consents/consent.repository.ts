import type { DatabaseClient } from '../database/database.types';
import type {
  ConsentDocument,
  ConsentRecord,
  CreateConsentRecordInput,
} from './consent.types';

export const CONSENT_REPOSITORY = Symbol('CONSENT_REPOSITORY');

/**
 * Persistence port for the consent domain. The domain and application layers
 * depend on this interface; the Postgres adapter is wired at the module
 * boundary.
 *
 * The optional `client` argument lets a caller join an existing transaction —
 * registration writes the account and its consent evidence atomically. When it
 * is omitted the adapter opens its own transaction.
 */
export interface ConsentRepository {
  findActiveDocuments(): Promise<ConsentDocument[]>;
  findActiveDocumentByCode(code: string): Promise<ConsentDocument | null>;
  findRecordsByUser(userId: string): Promise<ConsentRecord[]>;
  findLatestRecordByCode(
    userId: string,
    code: string,
  ): Promise<ConsentRecord | null>;
  findUserName(userId: string): Promise<string | null>;
  insertRecord(
    input: CreateConsentRecordInput,
    client?: DatabaseClient,
  ): Promise<ConsentRecord>;
  insertRecords(
    inputs: CreateConsentRecordInput[],
    client?: DatabaseClient,
  ): Promise<ConsentRecord[]>;
}
