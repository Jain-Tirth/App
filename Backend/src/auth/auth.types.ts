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
}

export interface AuthenticatedUser extends AuthTokenPayload {
  iat?: number;
  exp?: number;
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
