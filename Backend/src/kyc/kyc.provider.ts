import { randomUUID } from 'node:crypto';

export const KYC_PROVIDER = Symbol('KYC_PROVIDER');

export type KycProviderOutcome = 'passed' | 'needsReview' | 'failed';

export interface DocumentResult {
  mediaId: string;
  outcome: KycProviderOutcome;
}

export interface SelfieResult {
  mediaId: string;
  outcome: KycProviderOutcome;
}

export interface VerificationResult {
  sessionId: string;
  outcome: KycProviderOutcome;
}

/** The provider contract of spec/04 section 3.7. */
export interface KycProvider {
  createSession(input: {
    userId: string;
    language: string;
  }): Promise<{ sessionId: string; redirectUrl?: string }>;
  submitDocument(input: {
    sessionId: string;
    mediaId: string;
    side: 'front' | 'back';
  }): Promise<DocumentResult>;
  submitSelfie(input: {
    sessionId: string;
    mediaId: string;
  }): Promise<SelfieResult>;
  getResult(sessionId: string): Promise<VerificationResult>;
  parseWebhook(payload: unknown, signature: string): VerificationResult;
}

/**
 * Launch provider: every case goes to an admin. It runs no OCR or face match
 * and makes no network call.
 */
export class ManualKycProvider implements KycProvider {
  async createSession(): Promise<{ sessionId: string }> {
    return { sessionId: `manual-${randomUUID()}` };
  }

  async submitDocument(input: {
    sessionId: string;
    mediaId: string;
    side: 'front' | 'back';
  }): Promise<DocumentResult> {
    return { mediaId: input.mediaId, outcome: 'needsReview' };
  }

  async submitSelfie(input: {
    sessionId: string;
    mediaId: string;
  }): Promise<SelfieResult> {
    return { mediaId: input.mediaId, outcome: 'needsReview' };
  }

  async getResult(sessionId: string): Promise<VerificationResult> {
    return { sessionId, outcome: 'needsReview' };
  }

  parseWebhook(): VerificationResult {
    return { sessionId: '', outcome: 'needsReview' };
  }
}

/** Deterministic provider for tests: every call returns the configured outcome. */
export class FakeKycProvider implements KycProvider {
  readonly calls: string[] = [];
  private sessionCount = 0;

  constructor(private readonly outcome: KycProviderOutcome = 'needsReview') {}

  async createSession(input: {
    userId: string;
    language: string;
  }): Promise<{ sessionId: string }> {
    this.calls.push(`createSession:${input.userId}`);
    this.sessionCount += 1;
    return { sessionId: `fake-session-${this.sessionCount}` };
  }

  async submitDocument(input: {
    sessionId: string;
    mediaId: string;
    side: 'front' | 'back';
  }): Promise<DocumentResult> {
    this.calls.push(`submitDocument:${input.mediaId}`);
    return { mediaId: input.mediaId, outcome: this.outcome };
  }

  async submitSelfie(input: {
    sessionId: string;
    mediaId: string;
  }): Promise<SelfieResult> {
    this.calls.push(`submitSelfie:${input.mediaId}`);
    return { mediaId: input.mediaId, outcome: this.outcome };
  }

  async getResult(sessionId: string): Promise<VerificationResult> {
    return { sessionId, outcome: this.outcome };
  }

  parseWebhook(): VerificationResult {
    return { sessionId: '', outcome: this.outcome };
  }
}
