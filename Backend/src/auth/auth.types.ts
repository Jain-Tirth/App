export type Role = 'user' | 'admin';
export type AccountStatus = 'pending' | 'active' | 'rejected' | 'blocked';
export type ProfileCreatedBy =
  | 'myself'
  | 'son'
  | 'daughter'
  | 'brother'
  | 'sister'
  | 'friend'
  | 'relative';
export type Gender = 'male' | 'female';

export interface AuthTokenPayload {
  sub: string;
  email: string;
  role: Role;
  /**
   * Session version the token was issued under. A token without one counts as
   * version 0, so tokens issued before logout-all existed stay valid until
   * the member first uses it.
   */
  sv?: number;
}

export interface AuthenticatedUser extends AuthTokenPayload {
  iat?: number;
  exp?: number;
  /** Set when the member has a pending account deletion. */
  deletionScheduledPurgeAt?: Date | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthUserResponse {
  id: string;
  email: string;
  name: string;
  mobile: string;
  role: Role;
  accountStatus: AccountStatus;
  mobileVerified: boolean;
  profileCreatedBy: ProfileCreatedBy | null;
}
