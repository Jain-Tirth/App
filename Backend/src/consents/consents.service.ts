import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ApiException } from '../common/api-error';
import type { ClientRequestContext } from '../common/request-context';
import type { DatabaseClient } from '../database/database.types';
import {
  calculateExpiresAt,
  evaluateRequiredConsents,
  getConsentText,
  matchesActiveDocument,
  resolveResponseLanguage,
  summarizeConsent,
  summarizeDocument,
} from './consent.domain';
import {
  CONSENT_REPOSITORY,
  type ConsentRepository,
} from './consent.repository';
import {
  REQUIRED_CONSENT_CODES,
  type ConsentDocument,
  type ConsentDocumentSummary,
  ConsentInput,
  ConsentLanguage,
  ConsentRecord,
  ConsentRequestContext,
  CreateConsentRecordInput,
  CurrentConsent,
  ValidatedConsent,
} from './consent.types';

export interface CurrentConsentsResult {
  language: ConsentLanguage;
  consents: CurrentConsent[];
}

export interface ConsentDocumentsResult {
  language: ConsentLanguage;
  documents: ConsentDocumentSummary[];
}

export interface ConsentHistoryResult {
  total: number;
  records: ConsentRecord[];
}

@Injectable()
export class ConsentsService {
  constructor(
    @Inject(CONSENT_REPOSITORY)
    private readonly repository: ConsentRepository,
  ) {}

  async getCurrentConsents(
    userId: string,
    requestedLanguage?: string,
  ): Promise<CurrentConsentsResult> {
    const documents = await this.repository.findActiveDocuments();
    const latestRecords = await Promise.all(
      documents.map((document) =>
        this.repository.findLatestRecordByCode(userId, document.code),
      ),
    );

    const now = new Date();
    const consents = documents.map((document, index) =>
      summarizeConsent(
        document,
        latestRecords[index],
        requestedLanguage,
        now,
      ),
    );

    return {
      language: resolveResponseLanguage(requestedLanguage),
      consents,
    };
  }

  /**
   * True when the member holds a current, unexpired consent for every required
   * code. Other modules (identity verification) gate on this.
   */
  async hasValidRequiredConsents(userId: string): Promise<boolean> {
    const { consents } = await this.getCurrentConsents(userId);

    return REQUIRED_CONSENT_CODES.every((code) => {
      const consent = consents.find((item) => item.code === code);

      return consent !== undefined && !consent.requiresReconsent;
    });
  }

  /**
   * The documents a pre-authentication registration client must display and
   * accept. No member data is involved, so the route is public.
   */
  async getActiveConsentDocuments(
    requestedLanguage?: string,
  ): Promise<ConsentDocumentsResult> {
    const documents = await this.repository.findActiveDocuments();

    return {
      language: resolveResponseLanguage(requestedLanguage),
      documents: documents.map((document) =>
        summarizeDocument(document, requestedLanguage),
      ),
    };
  }

  async getConsentHistory(userId: string): Promise<ConsentHistoryResult> {
    const records = await this.repository.findRecordsByUser(userId);

    return {
      total: records.length,
      records,
    };
  }

  async recordConsent(
    userId: string,
    input: ConsentInput,
    context: ConsentRequestContext,
  ): Promise<ConsentRecord> {
    const document = await this.requireActiveDocument(input);
    const userName = await this.requireUserName(userId);

    return this.repository.insertRecord(
      this.buildRecord(userId, userName, document, context),
    );
  }

  async renewConsent(
    userId: string,
    input: ConsentInput,
    context: ClientRequestContext,
  ): Promise<ConsentRecord> {
    return this.recordConsent(userId, input, {
      ...context,
      source: 'renewal',
    });
  }

  /**
   * Validates the consents submitted with registration before any account is
   * created. Required codes that are absent or stale are reported together.
   */
  async validateRegistrationConsents(
    inputs: ConsentInput[],
  ): Promise<ValidatedConsent[]> {
    const documents = await this.repository.findActiveDocuments();
    const evaluation = evaluateRequiredConsents(inputs, documents);

    if (evaluation.missingCodes.length > 0) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'CONSENT_REQUIRED',
        'Required consents are missing or out of date.',
        { missingConsents: evaluation.missingCodes },
      );
    }

    if (evaluation.invalidCodes.length > 0) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'CONSENT_DOCUMENT_MISMATCH',
        'A submitted consent does not match the active document.',
        { codes: evaluation.invalidCodes },
      );
    }

    return evaluation.accepted;
  }

  async recordRegistrationConsents(
    user: { id: string; name: string },
    accepted: ValidatedConsent[],
    context: ClientRequestContext,
    client?: DatabaseClient,
  ): Promise<ConsentRecord[]> {
    const records = accepted.map((item) =>
      this.buildRecord(user.id, user.name, item.document, {
        ...context,
        source: 'registration',
      }),
    );

    return this.repository.insertRecords(records, client);
  }

  private async requireActiveDocument(
    input: ConsentInput,
  ): Promise<ConsentDocument> {
    const document = await this.repository.findActiveDocumentByCode(input.code);

    if (!document || !matchesActiveDocument(input, document)) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'CONSENT_DOCUMENT_MISMATCH',
        'The consent document version or hash does not match the active document.',
        {
          code: input.code,
          expectedVersion: document?.version ?? null,
          expectedHash: document?.hash ?? null,
        },
      );
    }

    return document;
  }

  private async requireUserName(userId: string): Promise<string> {
    const userName = await this.repository.findUserName(userId);

    if (!userName) {
      throw new ApiException(
        HttpStatus.NOT_FOUND,
        'USER_NOT_FOUND',
        'Member account not found.',
      );
    }

    return userName;
  }

  private buildRecord(
    userId: string,
    userName: string,
    document: ConsentDocument,
    context: ConsentRequestContext,
  ): CreateConsentRecordInput {
    const { language, text } = getConsentText(document, context.language);
    const grantedAt = new Date();

    return {
      userId,
      userName,
      code: document.code,
      version: document.version,
      documentHash: document.hash,
      textSnapshot: text,
      language,
      ip: context.ip,
      userAgent: context.userAgent,
      grantedAt,
      expiresAt: calculateExpiresAt(grantedAt),
      source: context.source,
    };
  }
}
