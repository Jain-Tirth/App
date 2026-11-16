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

export type ScheduleDeletionResult =
  | { kind: 'scheduled'; state: DeletionState }
  | { kind: 'alreadyPending' };

/** Settings, session revocation, export and deletion state of one member. */
export interface AccountRepository {
  getSettings(userId: string): Promise<AccountSettings | null>;
  updateSettings(userId: string, patch: SettingsPatch): Promise<AccountSettings>;
  /** Revokes every refresh token and access token the member holds. */
  revokeAllSessions(userId: string): Promise<void>;

  /** Creates a pending request unless an unexpired pending one exists. */
  createExportRequest(
    userId: string,
    now: Date,
    expiresAt: Date,
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

  scheduleDeletion(
    userId: string,
    requestedAt: Date,
    purgeAt: Date,
  ): Promise<ScheduleDeletionResult>;
  findDeletion(userId: string): Promise<DeletionState | null>;
  cancelDeletion(userId: string): Promise<void>;
}

export interface FailureWindow {
  count: number;
  oldestAt: Date | null;
}

/** What the password step-up needs from storage. */
export interface StepUpRepository {
  findPasswordHash(userId: string): Promise<string | null>;
  failuresSince(userId: string, since: Date): Promise<FailureWindow>;
  recordFailure(userId: string, at: Date): Promise<void>;
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
   * Strips the retained evidence rows and removes the member's rows in one
   * transaction. Returns false when the account is no longer due.
   */
  purge(userId: string, now: Date): Promise<boolean>;
}
