export const CONSENT_LANGUAGES = ['en', 'hi', 'gu'] as const;
export type ConsentLanguage = (typeof CONSENT_LANGUAGES)[number];

export const DEFAULT_CONSENT_LANGUAGE: ConsentLanguage = 'en';

export const REQUIRED_CONSENT_CODES = [
  'terms',
  'privacy',
  'id_processing',
] as const;
export type RequiredConsentCode = (typeof REQUIRED_CONSENT_CODES)[number];

export const CONSENT_VALIDITY_MONTHS = 24;

export type ConsentSource = 'registration' | 'api' | 'renewal';

export interface ConsentDocument {
  id: string;
  code: string;
  version: string;
  hash: string;
  effectiveAt: Date;
  isActive: boolean;
  translations: Partial<Record<ConsentLanguage, string>>;
}

export interface ConsentRecord {
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
  grantedAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  source: ConsentSource;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConsentInput {
  code: string;
  version: string;
  documentHash: string;
}

export interface ValidatedConsent {
  input: ConsentInput;
  document: ConsentDocument;
}

export interface CreateConsentRecordInput {
  userId: string;
  userName: string;
  code: string;
  version: string;
  documentHash: string;
  textSnapshot: string;
  language: ConsentLanguage;
  ip: string;
  userAgent: string;
  grantedAt: Date;
  expiresAt: Date;
  source: ConsentSource;
}

export interface ConsentRequestContext {
  ip: string;
  userAgent: string;
  language?: string | null;
  source: ConsentSource;
}

export interface CurrentConsent {
  code: string;
  version: string;
  hash: string;
  effectiveAt: Date;
  text: string;
  accepted: boolean;
  grantedAt: Date | null;
  expiresAt: Date | null;
  expired: boolean;
  requiresReconsent: boolean;
}
