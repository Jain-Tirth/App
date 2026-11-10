import {
  CONSENT_LANGUAGES,
  CONSENT_VALIDITY_MONTHS,
  DEFAULT_CONSENT_LANGUAGE,
  REQUIRED_CONSENT_CODES,
  type ConsentDocument,
  type ConsentInput,
  type ConsentLanguage,
  type ConsentRecord,
  type CurrentConsent,
  type ValidatedConsent,
} from './consent.types';

export function isConsentLanguage(value: string): value is ConsentLanguage {
  return (CONSENT_LANGUAGES as readonly string[]).includes(value);
}

/**
 * Add calendar months in UTC, clamping to the last day of the target month.
 * 31 Jan + 1 month becomes 28/29 Feb rather than rolling into March.
 */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  const originalDay = result.getUTCDate();

  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);

  const daysInTargetMonth = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate();

  result.setUTCDate(Math.min(originalDay, daysInTargetMonth));
  return result;
}

export function calculateExpiresAt(grantedAt: Date): Date {
  return addMonths(grantedAt, CONSENT_VALIDITY_MONTHS);
}

export function isExpired(expiresAt: Date | string, now: Date = new Date()): boolean {
  return new Date(expiresAt).getTime() <= now.getTime();
}

export function resolveConsentLanguage(
  requestedLanguage: string | null | undefined,
  translations: Partial<Record<ConsentLanguage, string>>,
): ConsentLanguage {
  if (
    requestedLanguage &&
    isConsentLanguage(requestedLanguage) &&
    Boolean(translations[requestedLanguage])
  ) {
    return requestedLanguage;
  }

  return DEFAULT_CONSENT_LANGUAGE;
}

export function getConsentText(
  document: ConsentDocument,
  requestedLanguage: string | null | undefined,
): { language: ConsentLanguage; text: string } {
  const language = resolveConsentLanguage(
    requestedLanguage,
    document.translations,
  );
  const text = document.translations[language];

  if (!text) {
    throw new Error(
      `Consent document ${document.code}@${document.version} has no ${language} text.`,
    );
  }

  return { language, text };
}

export function matchesActiveDocument(
  input: ConsentInput,
  document: ConsentDocument,
): boolean {
  return (
    input.code === document.code &&
    input.version === document.version &&
    input.documentHash.trim().toLowerCase() === document.hash.toLowerCase()
  );
}

export interface RequiredConsentEvaluation {
  accepted: ValidatedConsent[];
  missingCodes: string[];
  invalidCodes: string[];
}

/**
 * Validates every submitted consent against the currently active document for
 * its code and reports which required codes are missing or stale.
 */
export function evaluateRequiredConsents(
  inputs: ConsentInput[],
  activeDocuments: ConsentDocument[],
): RequiredConsentEvaluation {
  const documentsByCode = new Map(
    activeDocuments.map((document) => [document.code, document]),
  );
  const accepted: ValidatedConsent[] = [];
  const invalidCodes: string[] = [];
  const acceptedCodes = new Set<string>();

  for (const input of inputs) {
    const document = documentsByCode.get(input.code);

    if (!document || !matchesActiveDocument(input, document)) {
      invalidCodes.push(input.code);
      continue;
    }

    if (acceptedCodes.has(input.code)) {
      continue;
    }

    acceptedCodes.add(input.code);
    accepted.push({ input, document });
  }

  const missingCodes = REQUIRED_CONSENT_CODES.filter(
    (code) => !acceptedCodes.has(code),
  );

  return { accepted, missingCodes, invalidCodes };
}

export function summarizeConsent(
  document: ConsentDocument,
  record: ConsentRecord | null,
  requestedLanguage: string | null | undefined,
  now: Date,
): CurrentConsent {
  const { text } = getConsentText(document, requestedLanguage);
  const expired = record ? isExpired(record.expiresAt, now) : false;
  const versionIsCurrent =
    !record ||
    (record.version === document.version &&
      record.documentHash.toLowerCase() === document.hash.toLowerCase());

  return {
    code: document.code,
    version: document.version,
    hash: document.hash,
    effectiveAt: document.effectiveAt,
    text,
    accepted: Boolean(record),
    grantedAt: record?.grantedAt ?? null,
    expiresAt: record?.expiresAt ?? null,
    expired,
    requiresReconsent: !record || expired || !versionIsCurrent,
  };
}
