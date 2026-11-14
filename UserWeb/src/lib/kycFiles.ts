import { describeCode } from '../errors/messages';
import type { KycDocumentType, KycPurpose } from '../types';

export const MAX_FILE_BYTES = 10 * 1024 * 1024;

const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ID_TYPES = [...PHOTO_TYPES, 'application/pdf'];

export const ACCEPT_BY_PURPOSE: Record<KycPurpose, string> = {
  kycPhoto: PHOTO_TYPES.join(','),
  kycId: ID_TYPES.join(','),
};

export const DOCUMENT_TYPES: Array<{ value: KycDocumentType; label: string }> = [
  { value: 'aadhaar', label: 'Aadhaar' },
  { value: 'pan', label: 'PAN card' },
  { value: 'drivingLicence', label: 'Driving licence' },
  { value: 'rationCard', label: 'Ration card' },
  { value: 'voterId', label: 'Voter ID' },
  { value: 'other', label: 'Other government ID' },
];

const ID_NUMBER = /^[A-Za-z0-9 -]{4,32}$/;

export function isValidIdNumber(value: string): boolean {
  return ID_NUMBER.test(value.trim());
}

/** Error code for a file the server would refuse, or null when it looks fine. */
export function fileProblemCode(
  purpose: KycPurpose,
  file: { type: string; size: number },
): string | null {
  if (!ID_TYPES.includes(file.type)) return 'FILE_TYPE_NOT_ALLOWED';
  if (purpose === 'kycPhoto' && !PHOTO_TYPES.includes(file.type)) {
    return 'FILE_TYPE_NOT_ALLOWED_FOR_PURPOSE';
  }
  if (file.size <= 0) return 'FILE_CONTENT_MISMATCH';
  if (file.size > MAX_FILE_BYTES) return 'FILE_TOO_LARGE';
  return null;
}

/** Friendly message for a file the server would refuse, or null. */
export function fileProblemMessage(
  purpose: KycPurpose,
  file: { type: string; size: number },
): string | null {
  const code = fileProblemCode(purpose, file);
  return code ? describeCode(code, null, 'kycUpload').message : null;
}
