import type {
  AdminLoginResponse,
  DashboardStats,
  DecisionBody,
  PendingProfile,
  ReopenBody,
  ReopenResult,
  ReviewWorkspace,
  SignedDocument,
} from './types';

import { env } from './config/env';
import { AdminApiError } from './errors/adminApiError';

export { AdminApiError } from './errors/adminApiError';

const API_BASE = env.apiBaseUrl;
const REOPEN_TIMEOUT_MS = 20_000;

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(errorBody || 'Request failed');
  }

  return response.json() as Promise<T>;
}

function errorCodeOf(text: string): string {
  try {
    const body: unknown = JSON.parse(text);
    if (body && typeof body === 'object' && 'code' in body) {
      const code = (body as { code: unknown }).code;
      if (typeof code === 'string' && code.length > 0) return code;
    }
  } catch {
    // Not JSON: reported as NON_JSON_RESPONSE below.
  }
  return 'NON_JSON_RESPONSE';
}

/**
 * Used by the reopen call only. Failures become an `AdminApiError` with a code
 * and no raw text; the 20 second timeout is the one network policy of this call.
 */
async function requestTyped<T>(path: string, options: RequestInit, token: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REOPEN_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    });
  } catch (cause) {
    const aborted = cause instanceof Error && cause.name === 'AbortError';
    throw new AdminApiError({ code: aborted ? 'TIMEOUT' : 'NETWORK_ERROR', status: 0 });
  } finally {
    clearTimeout(timer);
  }

  const text = await response.text();
  if (!response.ok) {
    throw new AdminApiError({ code: errorCodeOf(text), status: response.status });
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new AdminApiError({ code: 'NON_JSON_RESPONSE', status: response.status });
  }
}

function decide(
  token: string,
  userId: string,
  action: 'approve' | 'reject' | 'request-changes',
  body: DecisionBody,
) {
  return request(
    `/admin/profiles/${userId}/${action}`,
    { method: 'PATCH', body: JSON.stringify(body) },
    token,
  );
}

export const api = {
  login(email: string, password: string) {
    return request<AdminLoginResponse>('/admin/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },
  getStats(token: string) {
    return request<DashboardStats>('/admin/stats', {}, token);
  },
  getPendingProfiles(token: string) {
    return request<{ total: number; profiles: PendingProfile[] }>(
      '/admin/profiles/pending',
      {},
      token,
    );
  },
  getWorkspace(token: string, userId: string) {
    return request<ReviewWorkspace>(`/admin/profiles/${userId}`, {}, token);
  },
  /** Each call is an audited ID view on the server. */
  openIdDocument(token: string, userId: string) {
    return request<SignedDocument>(
      `/admin/profiles/${userId}/id-document`,
      {},
      token,
    );
  },
  approveProfile(token: string, userId: string, body: DecisionBody = {}) {
    return decide(token, userId, 'approve', body);
  },
  rejectProfile(token: string, userId: string, body: DecisionBody) {
    return decide(token, userId, 'reject', body);
  },
  requestChanges(token: string, userId: string, body: DecisionBody) {
    return decide(token, userId, 'request-changes', body);
  },
  reopenProfile(token: string, userId: string, body: ReopenBody) {
    return requestTyped<ReopenResult>(
      `/admin/profiles/${userId}/reopen`,
      { method: 'POST', body: JSON.stringify(body) },
      token,
    );
  },
};
