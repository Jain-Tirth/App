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

export interface PendingProfile {
  userId: string;
  profileId: string;
  profileUid: string | null;
  name: string;
  email: string;
  mobile: string;
  gender: string | null;
  profileCreatedBy: string | null;
  accountStatus: string;
  profileComplete: number;
  createdAt: string;
}

export interface ReviewProfileResponse {
  profile: {
    id: string;
    userId: string;
    profileUid: string | null;
    profileComplete: number;
    createdAt: string;
    updatedAt: string;
    user: {
      id: string;
      name: string;
      email: string;
      mobile: string;
      role: string;
      gender: string | null;
      accountStatus: string;
      rejectionReason: string | null;
      profileCreatedBy: string | null;
      mobileVerified: boolean;
      createdAt: string;
      updatedAt: string;
    };
    personalDetails: Record<string, unknown>;
    religiousDetails: Record<string, unknown>;
    locationDetails: Record<string, unknown>;
    professionalDetails: Record<string, unknown>;
    additionalDetails: Record<string, unknown>;
    verificationFlags: Record<string, unknown>;
  };
}
