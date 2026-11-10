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
  insertRecord(input: CreateConsentRecordInput): Promise<ConsentRecord>;
  insertRecords(inputs: CreateConsentRecordInput[]): Promise<ConsentRecord[]>;
}
