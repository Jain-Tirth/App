import type {
  KycCase,
  KycDocumentType,
  KycMedia,
  KycPurpose,
  KycStatus,
} from './kyc.types';

export const KYC_REPOSITORY = Symbol('KYC_REPOSITORY');

export interface IdDetails {
  documentType: KycDocumentType;
  idNumberEncrypted: string;
  idNumberLast4: string;
}

export interface NewPendingMedia {
  id: string;
  verificationId: string;
  userId: string;
  purpose: KycPurpose;
  contentType: string;
  sizeBytes: number;
  storageKey: string;
}

export interface AttachMediaInput {
  userId: string;
  mediaId: string;
  checksum: string;
  now: Date;
  /** Picks the next status from the purposes attached after this file. */
  decideStatus: (current: KycCase, attached: KycPurpose[]) => KycStatus;
}

export interface AttachMediaOutcome {
  verification: KycCase;
  /** Storage key of the file this upload replaced, if any. */
  replacedStorageKey: string | null;
}

export type RestartPlan =
  | { kind: 'blocked'; retryAfterSeconds: number }
  | { kind: 'proceed'; nextStatus: KycStatus };

export interface RestartInput {
  userId: string;
  now: Date;
  /** Receives the case and the restart times of the last 24 hours. */
  decide: (current: KycCase, previousRestarts: Date[]) => RestartPlan;
}

export type RestartOutcome =
  | { kind: 'notFound' }
  | { kind: 'blocked'; retryAfterSeconds: number }
  | { kind: 'restarted'; verification: KycCase; removedStorageKeys: string[] };

/**
 * Persistence port for manual KYC. Methods that must be atomic (attach, restart)
 * run their decision callback while holding the case lock, so a concurrent
 * request cannot interleave.
 */
export interface KycRepository {
  findCaseByUser(userId: string): Promise<KycCase | null>;
  /** Returns null when the member already has a case. */
  createCase(input: {
    userId: string;
    status: KycStatus;
    providerSessionId: string;
  }): Promise<KycCase | null>;
  setIdDetails(verificationId: string, details: IdDetails): Promise<void>;
  insertPendingMedia(input: NewPendingMedia): Promise<KycMedia>;
  findMedia(userId: string, mediaId: string): Promise<KycMedia | null>;
  listAttachedMedia(verificationId: string): Promise<KycMedia[]>;
  deleteMedia(mediaId: string): Promise<void>;
  attachMedia(input: AttachMediaInput): Promise<AttachMediaOutcome>;
  restartCase(input: RestartInput): Promise<RestartOutcome>;
}
