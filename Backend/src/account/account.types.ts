export const ACCOUNT_REPOSITORY = Symbol('ACCOUNT_REPOSITORY');
export const STEP_UP_REPOSITORY = Symbol('STEP_UP_REPOSITORY');
export const PURGE_REPOSITORY = Symbol('PURGE_REPOSITORY');
export const ACCOUNT_CONFIG = Symbol('ACCOUNT_CONFIG');
export const ACCOUNT_CLOCK = Symbol('ACCOUNT_CLOCK');

export const LANGUAGES = ['en', 'hi', 'gu'] as const;
export type Language = (typeof LANGUAGES)[number];

export const PROFILE_VISIBILITIES = ['all', 'hidden'] as const;
export type ProfileVisibility = (typeof PROFILE_VISIBILITIES)[number];

/** In-app notification kinds the member can switch off. */
export const NOTIFICATION_KEYS = [
  'interestReceived',
  'interestAccepted',
  'profileApproved',
  'newMessage',
  'profileViewed',
] as const;
export type NotificationKey = (typeof NOTIFICATION_KEYS)[number];
export type NotificationPrefs = Record<NotificationKey, boolean>;

export interface AccountSettings {
  language: Language;
  notifications: NotificationPrefs;
  profileVisibility: ProfileVisibility;
}

export interface SettingsPatch {
  language?: Language;
  notifications?: Partial<NotificationPrefs>;
  profileVisibility?: ProfileVisibility;
}

export interface AccountConfig {
  deletionCoolingOffDays: number;
  exportLinkHours: number;
  stepUpMaxFailures: number;
  stepUpWindowMinutes: number;
}

export type Clock = () => Date;

export interface ExportRequestRecord {
  id: string;
  status: 'pending' | 'ready';
  requestedAt: Date;
  expiresAt: Date;
  archive: ExportArchive | null;
}

export interface ExportArchive {
  [section: string]: unknown;
}

export interface DeletionState {
  requestedAt: Date;
  scheduledPurgeAt: Date;
}

export type CreateExportResult =
  | { kind: 'created'; request: ExportRequestRecord }
  | { kind: 'alreadyPending' };

/** Member-initiated events written to "AccountAuditLog" (SEC-16). */
export const ACCOUNT_AUDIT_EVENTS = [
  'export_requested',
  'export_downloaded',
  'deletion_requested',
  'deletion_cancelled',
  'purge_executed',
  'logout_all',
] as const;
export type AccountAuditEvent = (typeof ACCOUNT_AUDIT_EVENTS)[number];

/** Where a request came from, the same two fields consent records keep. */
export interface AuditContext {
  ip: string;
  userAgent: string;
}

/** Settings, session revocation, export and deletion state of one member. */
export interface AccountRepository {
  getSettings(userId: string): Promise<AccountSettings | null>;
  updateSettings(userId: string, patch: SettingsPatch): Promise<AccountSettings>;
  /**
   * Revokes every refresh token and access token the member holds, and records
   * the event in the same transaction.
   */
  revokeAllSessions(userId: string, audit: AuditContext): Promise<void>;

  /**
   * Creates a pending request unless an unexpired pending one exists, and
   * records the event in the same transaction.
   */
  createExportRequest(
    userId: string,
    now: Date,
    expiresAt: Date,
    audit: AuditContext,
  ): Promise<CreateExportResult>;
  /** Only the member's own request; another member's id is not found. */
  findExportRequest(
    userId: string,
    requestId: string,
  ): Promise<ExportRequestRecord | null>;
  buildExportArchive(userId: string, now: Date): Promise<ExportArchive>;
  storeExportArchive(
    requestId: string,
    archive: ExportArchive,
    now: Date,
  ): Promise<ExportRequestRecord>;

  /** Records that the member is being served the archive of this request. */
  recordExportDownload(
    userId: string,
    requestId: string,
    audit: AuditContext,
  ): Promise<void>;

  /**
   * Schedules the purge and records the event in one transaction. A member
   * who already has a schedule keeps it (the call is idempotent).
   */
  scheduleDeletion(
    userId: string,
    requestedAt: Date,
    purgeAt: Date,
    audit: AuditContext,
  ): Promise<DeletionState>;
  findDeletion(userId: string): Promise<DeletionState | null>;
  /** Clears the schedule and records the event in one transaction. */
  cancelDeletion(userId: string, audit: AuditContext): Promise<void>;
}

export interface FailureWindow {
  count: number;
  oldestAt: Date | null;
}

/** The reads and the write of one step-up attempt, valid inside the lock. */
export interface StepUpAttempt {
  findPasswordHash(): Promise<string | null>;
  failuresSince(since: Date): Promise<FailureWindow>;
  recordFailure(at: Date): Promise<void>;
}

/** What the password step-up needs from storage. */
export interface StepUpRepository {
  /**
   * Runs `work` while holding the member's step-up lock, on one connection,
   * and commits what it recorded. Attempts of one member never overlap, so a
   * burst cannot read the same failure count; other members are not blocked.
   */
  runExclusive<T>(
    userId: string,
    work: (attempt: StepUpAttempt) => Promise<T>,
  ): Promise<T>;
}

export interface PurgeCandidate {
  userId: string;
}

/** What the purge job needs from storage. */
export interface PurgeRepository {
  findDue(now: Date): Promise<PurgeCandidate[]>;
  /** Object-storage keys that belong to the member and must be removed too. */
  findStorageKeys(userId: string): Promise<string[]>;
  /**
   * Strips the retained evidence rows, records the purge and removes the
   * member's rows in one transaction. Returns false when the account is no
   * longer due.
   */
  purge(userId: string, now: Date): Promise<boolean>;
}
