import { AccountStatus, Role } from '@prisma/client';

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
  profileCreatedBy: string | null;
}
