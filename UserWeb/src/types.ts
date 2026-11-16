export type ProfileCreatedBy =
  | 'myself'
  | 'son'
  | 'daughter'
  | 'brother'
  | 'sister'
  | 'friend'
  | 'relative';

export type Gender = 'male' | 'female';

export type ConsentLanguage = 'en' | 'hi' | 'gu';

export interface ConsentInput {
  code: string;
  version: string;
  documentHash: string;
}

export interface ConsentDocument {
  code: string;
  version: string;
  hash: string;
  effectiveAt?: string;
  text: string;
}

export interface ConsentDocumentsResponse {
  language: ConsentLanguage;
  documents: ConsentDocument[];
}

export interface CurrentConsent extends ConsentDocument {
  accepted: boolean;
  grantedAt?: string | null;
  expiresAt?: string | null;
  expired: boolean;
  requiresReconsent: boolean;
}

export interface CurrentConsentsResponse {
  language: ConsentLanguage;
  consents: CurrentConsent[];
}

export interface ConsentRecord {
  id: string;
  code: string;
  version: string;
  language: ConsentLanguage;
  grantedAt: string;
  expiresAt: string;
  revokedAt?: string | null;
  source: 'registration' | 'api' | 'renewal';
}

export interface ConsentRecordsResponse {
  total: number;
  records: ConsentRecord[];
}

export type RecordedConsent = ConsentRecord;

export interface RegisterPayload {
  fullName: string;
  email: string;
  password: string;
  countryCode: string;
  mobileNumber: string;
  profileCreatedBy: ProfileCreatedBy;
  language?: ConsentLanguage;
  consents: ConsentInput[];
}

export type KycStatus =
  | 'consentGiven'
  | 'documentUploaded'
  | 'needsReview'
  | 'changesNeeded'
  | 'failed'
  | 'approved';

export type KycPurpose = 'kycPhoto' | 'kycId';

export type KycDocumentType =
  | 'aadhaar'
  | 'pan'
  | 'drivingLicence'
  | 'rationCard'
  | 'voterId'
  | 'other';

export interface KycMedia {
  mediaId: string;
  purpose: KycPurpose;
  contentType: string;
  sizeBytes: number;
  attachedAt: string;
}

export interface KycVerification {
  id: string;
  status: KycStatus;
  documentType: KycDocumentType | null;
  idNumberLast4: string | null;
  media: KycMedia[];
  createdAt?: string;
  updatedAt?: string;
}

export interface KycUploadTicket {
  mediaId: string;
  uploadUrl: string;
  method: 'PUT';
  headers: Record<string, string>;
  expiresAt: string;
}

export type ReviewDecisionKind = 'approved' | 'rejected' | 'changesRequested';

export interface ReviewDecision {
  decision: ReviewDecisionKind;
  reasonCode: string | null;
  notes: string | null;
  sections: string[];
  decidedAt: string | null;
}

export type ProfileReviewStatus =
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'needsChanges'
  | 'rejected';

export interface RegisterResponse {
  message: string;
  userId: string;
  mobile: string;
  otpExpiresAt: string;
  otpToken?: string;
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
      profileReviewStatus: ProfileReviewStatus;
      rejectionReason?: string | null;
      reviewDecision?: ReviewDecision | null;
    };
    personalDetails: Record<string, unknown>;
    religiousDetails: Record<string, unknown>;
    locationDetails: Record<string, unknown>;
    professionalDetails: Record<string, unknown>;
    additionalDetails: Record<string, unknown>;
  } | null;
  completion: ProfileCompletion;
}

/** Story 6 result card. Carries profileRef only; never an internal id or profileUid. */
export interface DiscoveryCard {
  profileRef: string;
  firstName: string;
  age: number;
  city: string | null;
  religion: string | null;
  community: string | null;
  profession: string | null;
  photoRef: string | null;
  verified: boolean;
}

/** Story 6 profile detail. No contact field exists in this phase. */
export interface ProfileDetail extends DiscoveryCard {
  heightCm: number | null;
  maritalStatus: string | null;
  diet: string | null;
  spokenLanguages: string[];
  subcommunity: string | null;
  state: string | null;
  country: string | null;
  education: string | null;
  employmentType: string | null;
  familyStatus: string | null;
  aboutMyself: string | null;
  lookingFor: string | null;
}

export interface DiscoverySearchResponse {
  items: DiscoveryCard[];
  nextCursor: string | null;
}

export type InterestStatus = 'pending' | 'accepted' | 'declined' | 'withdrawn';
export type InterestTab = 'sent' | 'received';
export type InterestAction = 'accept' | 'decline' | 'withdraw';

/** Result of send, accept, decline and withdraw. */
export interface InterestView {
  id: string;
  status: InterestStatus;
  canChat: boolean;
  createdAt: string;
  respondedAt: string | null;
}

/** A list row: the other member as a story 6 card, plus the interest. */
export interface InterestListItem extends InterestView {
  member: DiscoveryCard;
}

export interface InterestListResponse {
  items: InterestListItem[];
  nextCursor: string | null;
}
