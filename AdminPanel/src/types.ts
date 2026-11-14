export interface AdminLoginResponse {
  message: string;
  accessToken: string;
  admin: {
    id: string;
    name: string;
    email: string;
    role: 'admin';
  };
}

export interface DashboardStats {
  pendingProfiles: number;
  approvedProfiles: number;
  rejectedProfiles: number;
  totalProfiles: number;
}

export type SlaState = 'ok' | 'atRisk' | 'overdue';

export interface PendingProfile {
  userId: string;
  profileUid: string | null;
  name: string;
  submittedAt: string;
  slaRemainingHours: number;
  slaState: SlaState;
}

export const REASON_CODES = [
  'unreadable-document',
  'expired-document',
  'name-mismatch',
  'photo-mismatch',
  'under-age',
  'prohibited-content',
  'incomplete-profile',
  'duplicate-account',
  'suspicious-activity',
  'terms-violation',
  'other',
] as const;
export type ReasonCode = (typeof REASON_CODES)[number];

/** Request-changes cannot offer problems the member cannot fix by editing. */
export const CHANGES_REASON_CODES: readonly ReasonCode[] = REASON_CODES.filter(
  (code) => code !== 'under-age' && code !== 'duplicate-account',
);

export const SECTIONS = ['step-1', 'step-2', 'step-3', 'step-4', 'step-5'] as const;
export type Section = (typeof SECTIONS)[number];

export interface ReviewWorkspace {
  userId: string;
  profileUid: string | null;
  name: string;
  dateOfBirth: string | null;
  age: number | null;
  ageCheck: 'pass' | 'fail';
  accountStatus: string;
  kycStatus: string | null;
  submittedAt: string | null;
  documentType: string | null;
  idNumberMasked: string | null;
  photo: { url: string; expiresAt: string; contentType: string };
  idDocument: { href: string; contentType: string };
}

export interface SignedDocument {
  url: string;
  expiresAt: string;
  contentType: string;
}

export interface DecisionBody {
  reasonCode?: ReasonCode;
  notes?: string;
  sections?: Section[];
}
