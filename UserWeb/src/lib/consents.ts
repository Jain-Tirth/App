import type { ConsentDocument, ConsentInput } from '../types';

export const REQUIRED_CONSENT_CODES = ['terms', 'privacy', 'id_processing'] as const;

/**
 * Builds the `consents` array for registration or renewal from the documents
 * that were shown. Returns null unless every required code is present in the
 * documents and ticked, so the caller can keep submit disabled.
 */
export function buildConsentPayload(
  documents: ConsentDocument[],
  accepted: Record<string, boolean>,
): ConsentInput[] | null {
  const payload: ConsentInput[] = [];
  for (const code of REQUIRED_CONSENT_CODES) {
    const document = documents.find((item) => item.code === code);
    if (!document || accepted[code] !== true) return null;
    payload.push({ code, version: document.version, documentHash: document.hash });
  }
  return payload;
}

/** Codes among the current consents that need the member to accept again. */
export function codesNeedingConsent(
  consents: Array<{ code: string; accepted: boolean; expired: boolean; requiresReconsent: boolean }>,
): string[] {
  return consents
    .filter((item) => !item.accepted || item.expired || item.requiresReconsent)
    .map((item) => item.code);
}
