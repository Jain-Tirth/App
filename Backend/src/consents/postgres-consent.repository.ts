import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import type { ConsentRepository } from './consent.repository';
import type {
  ConsentDocument,
  ConsentLanguage,
  ConsentRecord,
  ConsentSource,
  CreateConsentRecordInput,
} from './consent.types';

interface DocumentRow {
  id: string;
  code: string;
  version: string;
  documentHash: string;
  effectiveAt: Date | string;
  isActive: boolean;
  language: ConsentLanguage | null;
  text: string | null;
}

interface RecordRow {
  id: string;
  userId: string;
  userName: string;
  code: string;
  version: string;
  documentHash: string;
  textSnapshot: string;
  language: ConsentLanguage;
  ip: string;
  userAgent: string;
  grantedAt: Date | string;
  expiresAt: Date | string;
  revokedAt: Date | string | null;
  source: ConsentSource;
  createdAt: Date | string;
  updatedAt: Date | string;
}

const DOCUMENT_SELECT = `
  SELECT d."id",
         d."code",
         d."version",
         d."documentHash",
         d."effectiveAt",
         d."isActive",
         t."language",
         t."text"
  FROM "ConsentDocuments" d
  LEFT JOIN "ConsentDocumentTranslations" t ON t."documentId" = d."id"
`;

const RECORD_COLUMNS = `
  "id", "userId", "userName", "code", "version", "documentHash",
  "textSnapshot", "language", "ip", "userAgent", "grantedAt", "expiresAt",
  "revokedAt", "source", "createdAt", "updatedAt"
`;

@Injectable()
export class PostgresConsentRepository implements ConsentRepository {
  constructor(private readonly db: DatabaseService) {}

  async findActiveDocuments(): Promise<ConsentDocument[]> {
    const result = await this.db.query<DocumentRow>(
      `${DOCUMENT_SELECT}
       WHERE d."isActive" = true
       ORDER BY d."code" ASC, t."language" ASC`,
    );

    return this.groupDocuments(result.rows);
  }

  async findActiveDocumentByCode(
    code: string,
  ): Promise<ConsentDocument | null> {
    const result = await this.db.query<DocumentRow>(
      `${DOCUMENT_SELECT}
       WHERE d."isActive" = true AND d."code" = $1
       ORDER BY t."language" ASC`,
      [code],
    );

    return this.groupDocuments(result.rows)[0] ?? null;
  }

  async findRecordsByUser(userId: string): Promise<ConsentRecord[]> {
    const result = await this.db.query<RecordRow>(
      `SELECT ${RECORD_COLUMNS}
       FROM "ConsentRecords"
       WHERE "userId" = $1
       ORDER BY "grantedAt" DESC, "createdAt" DESC, "id" DESC`,
      [userId],
    );

    return result.rows.map((row) => this.mapRecord(row));
  }

  async findLatestRecordByCode(
    userId: string,
    code: string,
  ): Promise<ConsentRecord | null> {
    const result = await this.db.query<RecordRow>(
      `SELECT ${RECORD_COLUMNS}
       FROM "ConsentRecords"
       WHERE "userId" = $1 AND "code" = $2
       ORDER BY "grantedAt" DESC, "createdAt" DESC, "id" DESC
       LIMIT 1`,
      [userId, code],
    );

    const row = result.rows[0];
    return row ? this.mapRecord(row) : null;
  }

  async findUserName(userId: string): Promise<string | null> {
    const result = await this.db.query<{ name: string }>(
      'SELECT "name" FROM "Users" WHERE "id" = $1',
      [userId],
    );

    return result.rows[0]?.name ?? null;
  }

  async insertRecord(
    input: CreateConsentRecordInput,
  ): Promise<ConsentRecord> {
    const [record] = await this.insertRecords([input]);
    return record;
  }

  async insertRecords(
    inputs: CreateConsentRecordInput[],
  ): Promise<ConsentRecord[]> {
    if (inputs.length === 0) {
      return [];
    }

    return this.db.transaction(async (client) => {
      const records: ConsentRecord[] = [];

      for (const input of inputs) {
        const result = await client.query<RecordRow>(
          `INSERT INTO "ConsentRecords" (
             "userId", "userName", "code", "version", "documentHash",
             "textSnapshot", "language", "ip", "userAgent", "grantedAt",
             "expiresAt", "source"
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           RETURNING ${RECORD_COLUMNS}`,
          [
            input.userId,
            input.userName,
            input.code,
            input.version,
            input.documentHash,
            input.textSnapshot,
            input.language,
            input.ip,
            input.userAgent,
            input.grantedAt,
            input.expiresAt,
            input.source,
          ],
        );

        records.push(this.mapRecord(result.rows[0]));
      }

      return records;
    });
  }

  private groupDocuments(rows: DocumentRow[]): ConsentDocument[] {
    const documents = new Map<string, ConsentDocument>();

    for (const row of rows) {
      let document = documents.get(row.id);

      if (!document) {
        document = {
          id: row.id,
          code: row.code,
          version: row.version,
          hash: row.documentHash,
          effectiveAt: new Date(row.effectiveAt),
          isActive: row.isActive,
          translations: {},
        };
        documents.set(row.id, document);
      }

      if (row.language && row.text) {
        document.translations[row.language] = row.text;
      }
    }

    return [...documents.values()];
  }

  private mapRecord(row: RecordRow): ConsentRecord {
    return {
      id: row.id,
      userId: row.userId,
      userName: row.userName,
      code: row.code,
      version: row.version,
      documentHash: row.documentHash,
      textSnapshot: row.textSnapshot,
      language: row.language,
      ip: row.ip,
      userAgent: row.userAgent,
      grantedAt: new Date(row.grantedAt),
      expiresAt: new Date(row.expiresAt),
      revokedAt: row.revokedAt ? new Date(row.revokedAt) : null,
      source: row.source,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }
}
