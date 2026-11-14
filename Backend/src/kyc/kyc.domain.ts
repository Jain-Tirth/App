import { HttpStatus } from '@nestjs/common';
import { ApiException } from '../common/api-error';
import {
  KYC_MAX_FILE_BYTES,
  KYC_MAX_RESTARTS,
  KYC_RESTART_WINDOW_SECONDS,
  type KycEvent,
  type KycFileKind,
  type KycPurpose,
  type KycStatus,
  type RestartDecision,
} from './kyc.types';

const TRANSITIONS: Record<KycEvent, Partial<Record<KycStatus, KycStatus>>> = {
  start: { notStarted: 'consentGiven' },
  documentAttached: {
    consentGiven: 'documentUploaded',
    documentUploaded: 'documentUploaded',
  },
  allDocumentsAttached: {
    consentGiven: 'needsReview',
    documentUploaded: 'needsReview',
  },
  restart: { failed: 'consentGiven', changesNeeded: 'consentGiven' },
};

/**
 * The only function that decides a verification status change. Every writer of
 * the status column takes its target from here.
 */
export function transitionKycStatus(
  current: KycStatus,
  event: KycEvent,
): KycStatus {
  const next = TRANSITIONS[event][current];

  if (!next) {
    throw new ApiException(
      HttpStatus.CONFLICT,
      'INVALID_STATUS_TRANSITION',
      'This action is not allowed in the current verification status.',
      { status: current, event },
    );
  }

  return next;
}

const MIME_BY_KIND: Record<KycFileKind, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  pdf: 'application/pdf',
};

const ALLOWED_KINDS: Record<KycPurpose, readonly KycFileKind[]> = {
  kycPhoto: ['jpeg', 'png', 'webp'],
  kycId: ['jpeg', 'png', 'webp', 'pdf'],
};

/** Identifies a file by its leading bytes, never by extension or MIME type. */
export function detectFileKind(head: Buffer): KycFileKind | null {
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) {
    return 'jpeg';
  }

  if (
    head.length >= 8 &&
    head.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    )
  ) {
    return 'png';
  }

  if (
    head.length >= 12 &&
    head.subarray(0, 4).toString('latin1') === 'RIFF' &&
    head.subarray(8, 12).toString('latin1') === 'WEBP'
  ) {
    return 'webp';
  }

  if (head.length >= 5 && head.subarray(0, 5).toString('latin1') === '%PDF-') {
    return 'pdf';
  }

  return null;
}

function kindForMime(contentType: string): KycFileKind | null {
  const entry = Object.entries(MIME_BY_KIND).find(
    ([, mime]) => mime === contentType,
  );

  return entry ? (entry[0] as KycFileKind) : null;
}

function reject(code: string, message: string, details: unknown = null): never {
  throw new ApiException(HttpStatus.BAD_REQUEST, code, message, details);
}

/** Checks what the client declares before a presigned URL is issued. */
export function validateDeclaredUpload(
  purpose: KycPurpose,
  contentType: string,
  sizeBytes: number,
): void {
  if (sizeBytes > KYC_MAX_FILE_BYTES) {
    reject('FILE_TOO_LARGE', 'Files can be at most 10 MB.', {
      maxBytes: KYC_MAX_FILE_BYTES,
    });
  }

  const kind = kindForMime(contentType);

  if (!kind) {
    reject('FILE_TYPE_NOT_ALLOWED', 'This file type is not accepted.');
  }

  if (!ALLOWED_KINDS[purpose].includes(kind)) {
    reject(
      'FILE_TYPE_NOT_ALLOWED_FOR_PURPOSE',
      'This file type is not accepted for this upload.',
      { purpose },
    );
  }
}

/** Checks the bytes that actually reached storage against the declaration. */
export function validateStoredFile(
  purpose: KycPurpose,
  declaredContentType: string,
  head: Buffer,
): void {
  const detected = detectFileKind(head);

  if (detected && !ALLOWED_KINDS[purpose].includes(detected)) {
    reject(
      'FILE_TYPE_NOT_ALLOWED_FOR_PURPOSE',
      'This file type is not accepted for this upload.',
      { purpose },
    );
  }

  if (!detected || MIME_BY_KIND[detected] !== declaredContentType) {
    reject(
      'FILE_CONTENT_MISMATCH',
      'The file content does not match the declared type.',
    );
  }
}

export function normalizeIdNumber(value: string): string {
  return value.replace(/[\s-]/g, '').toUpperCase();
}

export function lastFour(normalizedIdNumber: string): string {
  return normalizedIdNumber.slice(-4);
}

/**
 * At most `KYC_MAX_RESTARTS` restarts per rolling 24 hours. A restart made
 * exactly 24 hours ago no longer counts.
 */
export function decideRestart(
  previousRestarts: Date[],
  now: Date,
): RestartDecision {
  const windowMs = KYC_RESTART_WINDOW_SECONDS * 1000;
  const inWindow = previousRestarts
    .filter((at) => now.getTime() - at.getTime() < windowMs)
    .sort((a, b) => a.getTime() - b.getTime());

  if (inWindow.length < KYC_MAX_RESTARTS) {
    return { allowed: true };
  }

  const blockingUntil = inWindow[inWindow.length - KYC_MAX_RESTARTS].getTime() + windowMs;

  return {
    allowed: false,
    retryAfterSeconds: Math.ceil((blockingUntil - now.getTime()) / 1000),
  };
}
