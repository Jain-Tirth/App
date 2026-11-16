import type {
  ConsentDocumentsResponse,
  ConsentInput,
  ConsentRecordsResponse,
  CurrentConsentsResponse,
  KycDocumentType,
  KycPurpose,
  KycUploadTicket,
  KycVerification,
  LoginResponse,
  DiscoveryCard,
  DiscoverySearchResponse,
  InterestListResponse,
  InterestStatus,
  InterestView,
  ProfileDetail,
  ProfileResponse,
  RecordedConsent,
  RegisterPayload,
  RegisterResponse,
  VerifyOtpResponse,
} from './types';
import { env } from './config/env';
import { ApiError } from './apiError';
import { buildSearchParams } from './lib/discovery';

export { ApiError } from './apiError';

const DEFAULT_TIMEOUT_MS = 20_000;

let notApprovedListener: (() => void) | null = null;

/** Registers the one app-level reaction to PROFILE_NOT_APPROVED (refresh the profile, re-route). */
export function onProfileNotApproved(listener: (() => void) | null): void {
  notApprovedListener = listener;
}

function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
}

function headerValue(response: Response, name: string): string | null {
  return response.headers?.get?.(name) ?? null;
}

function parseJson(text: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

async function send(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (cause) {
    const aborted = cause instanceof Error && cause.name === 'AbortError';
    throw new ApiError({ code: aborted ? 'TIMEOUT' : 'NETWORK_ERROR', status: 0 });
  } finally {
    clearTimeout(timer);
  }
}

function toApiError(response: Response, text: string): ApiError {
  const retryAfter = parseRetryAfter(headerValue(response, 'retry-after'));
  const headerRequestId = headerValue(response, 'x-request-id');
  const parsed = parseJson(text);

  if (parsed.ok && parsed.value && typeof parsed.value === 'object') {
    const body = parsed.value as {
      code?: unknown;
      details?: unknown;
      requestId?: unknown;
    };
    if (typeof body.code === 'string' && body.code.length > 0) {
      return new ApiError({
        code: body.code,
        status: response.status,
        details: body.details ?? null,
        retryAfter,
        requestId: typeof body.requestId === 'string' ? body.requestId : headerRequestId,
      });
    }
  }

  return new ApiError({
    code: 'NON_JSON_RESPONSE',
    status: response.status,
    retryAfter,
    requestId: headerRequestId,
  });
}

export async function request<T>(
  path: string,
  options: RequestInit & { timeoutMs?: number } = {},
  token?: string,
): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, headers, ...init } = options;
  const response = await send(
    `${env.apiBaseUrl}${path}`,
    {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...((headers as Record<string, string> | undefined) ?? {}),
      },
    },
    timeoutMs,
  );

  const text = await response.text();

  if (!response.ok) {
    const apiError = toApiError(response, text);
    if (apiError.code === 'PROFILE_NOT_APPROVED') notApprovedListener?.();
    throw apiError;
  }

  if (response.status === 204 || text.trim() === '') {
    return undefined as T;
  }

  const parsed = parseJson(text);
  if (!parsed.ok) {
    throw new ApiError({
      code: 'NON_JSON_RESPONSE',
      status: response.status,
      requestId: headerValue(response, 'x-request-id'),
    });
  }
  return parsed.value as T;
}

/**
 * Sends raw bytes to a presigned storage URL. Storage is a different origin
 * and must see only the headers the ticket names: no Bearer token and no JSON
 * content type.
 */
export async function putToStorage(
  url: string,
  headers: Record<string, string>,
  body: Blob,
  timeoutMs = 120_000,
): Promise<void> {
  const response = await send(url, { method: 'PUT', headers, body }, timeoutMs);
  if (!response.ok) {
    throw new ApiError({
      code: 'HTTP_ERROR',
      status: response.status,
      requestId: null,
    });
  }
}

function json(body: unknown): { body: string } {
  return { body: JSON.stringify(body) };
}

export interface InterestListQuery {
  status?: InterestStatus | '';
  limit?: number;
  cursor?: string | null;
}

function interestQuery(query: InterestListQuery): string {
  const params = new URLSearchParams();
  if (query.status) params.set('status', query.status);
  if (typeof query.limit === 'number') params.set('limit', String(query.limit));
  if (query.cursor) params.set('cursor', query.cursor);
  const text = params.toString();
  return text ? `?${text}` : '';
}

export const api = {
  register(payload: RegisterPayload) {
    return request<RegisterResponse>('/auth/register', { method: 'POST', ...json(payload) });
  },
  resendOtp(countryCode: string, mobileNumber: string) {
    return request<RegisterResponse>('/auth/otp/resend', {
      method: 'POST',
      ...json({ countryCode, mobileNumber }),
    });
  },
  verifyOtp(countryCode: string, mobileNumber: string, otpCode: string, otpToken?: string) {
    return request<VerifyOtpResponse>('/auth/otp/verify', {
      method: 'POST',
      ...json({ countryCode, mobileNumber, otpCode, otpToken }),
    });
  },
  login(email: string, password: string) {
    return request<LoginResponse>('/auth/login', {
      method: 'POST',
      ...json({ email, password }),
    });
  },
  getMyProfile(token: string) {
    return request<ProfileResponse>('/profiles/me', {}, token);
  },
  discoveryRecommendations(token: string) {
    return request<{ items: DiscoveryCard[] }>('/discovery/recommendations', {}, token);
  },
  discoverySearch(token: string, query: Record<string, unknown>) {
    const qs = buildSearchParams(query).toString();
    return request<DiscoverySearchResponse>(`/discovery/search${qs ? `?${qs}` : ''}`, {}, token);
  },
  getProfileDetail(token: string, profileRef: string) {
    return request<ProfileDetail>(`/profiles/${encodeURIComponent(profileRef)}`, {}, token);
  },
  sendInterest(token: string, receiverProfileRef: string) {
    return request<InterestView>(
      '/interests',
      { method: 'POST', ...json({ receiverProfileRef }) },
      token,
    );
  },
  acceptInterest(token: string, id: string) {
    return request<InterestView>(
      `/interests/${encodeURIComponent(id)}/accept`,
      { method: 'POST' },
      token,
    );
  },
  declineInterest(token: string, id: string) {
    return request<InterestView>(
      `/interests/${encodeURIComponent(id)}/decline`,
      { method: 'POST' },
      token,
    );
  },
  withdrawInterest(token: string, id: string) {
    return request<InterestView>(
      `/interests/${encodeURIComponent(id)}/withdraw`,
      { method: 'POST' },
      token,
    );
  },
  listSentInterests(token: string, query: InterestListQuery = {}) {
    return request<InterestListResponse>(`/interests/sent${interestQuery(query)}`, {}, token);
  },
  listReceivedInterests(token: string, query: InterestListQuery = {}) {
    return request<InterestListResponse>(`/interests/received${interestQuery(query)}`, {}, token);
  },
  submitProfile(token: string) {
    return request<{ status: string }>('/profiles/submit', { method: 'POST' }, token);
  },
  withdrawProfile(token: string) {
    return request<{ status: string }>('/profiles/withdraw', { method: 'POST' }, token);
  },
  saveStep1(
    token: string,
    payload: {
      gender: 'male' | 'female';
      dateOfBirth: string;
      heightCm?: number;
      weightKg?: number;
      physicalStatus?: 'normal' | 'physicallyChallenged';
      maritalStatus?: 'neverMarried' | 'widower' | 'awaitingDivorce' | 'divorced';
      eatingHabits?: 'vegetarian' | 'nonVegetarian' | 'eggetarian';
      residentStatus?: string;
    },
  ) {
    return request<ProfileResponse>('/profiles/step-1', { method: 'PUT', ...json(payload) }, token);
  },
  saveStep2(token: string, payload: Record<string, unknown>) {
    return request<ProfileResponse>('/profiles/step-2', { method: 'PUT', ...json(payload) }, token);
  },
  saveStep3(token: string, payload: Record<string, unknown>) {
    return request<ProfileResponse>('/profiles/step-3', { method: 'PUT', ...json(payload) }, token);
  },
  saveStep4(token: string, payload: Record<string, unknown>) {
    return request<ProfileResponse>('/profiles/step-4', { method: 'PUT', ...json(payload) }, token);
  },
  saveStep5(token: string, payload: Record<string, unknown>) {
    return request<ProfileResponse>('/profiles/step-5', { method: 'PUT', ...json(payload) }, token);
  },

  // Consents
  getConsentDocuments(language: string) {
    return request<ConsentDocumentsResponse>(
      `/consents/documents?language=${encodeURIComponent(language)}`,
    );
  },
  getCurrentConsents(token: string, language: string) {
    return request<CurrentConsentsResponse>(
      `/consents/current?language=${encodeURIComponent(language)}`,
      {},
      token,
    );
  },
  getConsentHistory(token: string) {
    return request<ConsentRecordsResponse>('/consents', {}, token);
  },
  recordConsent(token: string, input: ConsentInput & { language?: string }, renew: boolean) {
    return request<RecordedConsent>(
      renew ? '/consents/renew' : '/consents',
      { method: 'POST', ...json(input) },
      token,
    );
  },

  // KYC
  createKycVerification(token: string) {
    return request<KycVerification>('/kyc/verification', { method: 'POST' }, token);
  },
  getKycVerification(token: string) {
    return request<KycVerification>('/kyc/verification', {}, token);
  },
  requestKycUpload(
    token: string,
    payload: {
      purpose: KycPurpose;
      contentType: string;
      sizeBytes: number;
      fileName: string;
      documentType?: KycDocumentType;
      idNumber?: string;
    },
  ) {
    return request<KycUploadTicket>(
      '/kyc/verification/uploads',
      { method: 'POST', ...json(payload) },
      token,
    );
  },
  completeKycUpload(token: string, mediaId: string, checksum: string) {
    return request<KycVerification>(
      `/kyc/verification/uploads/${encodeURIComponent(mediaId)}/complete`,
      { method: 'POST', ...json({ checksum }) },
      token,
    );
  },
  discardKycUpload(token: string, mediaId: string) {
    return request<void>(
      `/kyc/verification/uploads/${encodeURIComponent(mediaId)}`,
      { method: 'DELETE' },
      token,
    );
  },
  getKycMediaUrl(token: string, mediaId: string) {
    return request<{ url: string; expiresAt: string }>(
      `/kyc/verification/media/${encodeURIComponent(mediaId)}/url`,
      {},
      token,
    );
  },
  restartKycVerification(token: string) {
    return request<KycVerification>('/kyc/verification/restart', { method: 'POST' }, token);
  },
};
