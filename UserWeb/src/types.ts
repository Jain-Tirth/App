export type ProfileCreatedBy =
  | 'myself'
  | 'son'
  | 'daughter'
  | 'brother'
  | 'sister'
  | 'friend'
  | 'relative';

export type Gender = 'male' | 'female';

export interface RegisterPayload {
  fullName: string;
  email: string;
  password: string;
  countryCode: string;
  mobileNumber: string;
  profileCreatedBy: ProfileCreatedBy;
}

export interface RegisterResponse {
  message: string;
  userId: string;
  mobile: string;
  otpExpiresAt: string;
  otpCode?: string;
}

export interface VerifyOtpResponse {
  message: string;
  user: {
    id: string;
    email: string;
    name: string;
    mobile: string;
    role: string;
    accountStatus: string;
    mobileVerified: boolean;
    profileCreatedBy: string | null;
  };
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
}

export interface LoginResponse extends VerifyOtpResponse {}

export interface ProfileCompletion {
  percentage: number;
  completedSteps: number;
  totalSteps: number;
}

export interface ProfileResponse {
  profile: {
    id: string;
    userId: string;
    profileUid: string | null;
    profileComplete: number;
    user: {
      id: string;
      name: string;
      email: string;
      mobile: string;
      gender: string | null;
      profileCreatedBy: string | null;
      accountStatus: string;
    };
    personalDetails: Record<string, unknown>;
    religiousDetails: Record<string, unknown>;
    locationDetails: Record<string, unknown>;
    professionalDetails: Record<string, unknown>;
    additionalDetails: Record<string, unknown>;
  } | null;
  completion: ProfileCompletion;
}
