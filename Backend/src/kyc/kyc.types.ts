export const KYC_STATUSES = [
  'consentGiven',
  'documentUploaded',
  'needsReview',
  'changesNeeded',
  'failed',
  'approved',
] as const;

/** `notStarted` is the state before a case exists; it is never stored. */
export type KycStatus = 'notStarted' | (typeof KYC_STATUSES)[number];

export const KYC_DOCUMENT_TYPES = [
  'aadhaar',
  'pan',
  'drivingLicence',
  'rationCard',
  'voterId',
  'other',
] as const;
export type KycDocumentType = (typeof KYC_DOCUMENT_TYPES)[number];

export const KYC_PURPOSES = ['kycPhoto', 'kycId'] as const;
export type KycPurpose = (typeof KYC_PURPOSES)[number];

export type KycFileKind = 'jpeg' | 'png' | 'webp' | 'pdf';

export type KycEvent =
  | 'start'
  | 'documentAttached'
  | 'allDocumentsAttached'
  | 'restart';

/** 10 MB, inclusive. */
export const KYC_MAX_FILE_BYTES = 10 * 1024 * 1024;

/** Presigned upload and read URLs live 10 minutes (spec: 5 to 15). */
export const KYC_URL_TTL_SECONDS = 600;

export const KYC_MAX_RESTARTS = 3;
export const KYC_RESTART_WINDOW_SECONDS = 24 * 60 * 60;

export interface KycCase {
  id: string;
  userId: string;
  status: KycStatus;
  providerSessionId: string;
  documentType: KycDocumentType | null;
  idNumberEncrypted: string | null;
  idNumberLast4: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface KycMedia {
  id: string;
  verificationId: string;
  userId: string;
  purpose: KycPurpose;
  contentType: string;
  sizeBytes: number;
  storageKey: string;
  checksum: string | null;
  attachedAt: Date | null;
  createdAt: Date;
}

export type RestartDecision =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

export interface KycMediaView {
  mediaId: string;
  purpose: KycPurpose;
  contentType: string;
  sizeBytes: number;
  attachedAt: Date;
}

/** Member-facing projection. No storage key and no full ID number. */
export interface KycVerificationView {
  id: string;
  status: KycStatus;
  documentType: KycDocumentType | null;
  idNumberLast4: string | null;
  media: KycMediaView[];
  createdAt: Date;
  updatedAt: Date;
}
