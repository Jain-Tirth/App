import type {
  AdminLoginResponse,
  DashboardStats,
  DecisionBody,
  PendingProfile,
  ReviewWorkspace,
  SignedDocument,
} from './types';

import { env } from './config/env';

const API_BASE = env.apiBaseUrl;

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
};
