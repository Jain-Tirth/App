import type {
  AdminLoginResponse,
  DashboardStats,
  PendingProfile,
  ReviewProfileResponse,
} from './types';

const API_BASE = 'http://localhost:3000/api/v1';

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
  getProfile(token: string, userId: string) {
    return request<ReviewProfileResponse>(`/admin/profiles/${userId}`, {}, token);
  },
  approveProfile(token: string, userId: string) {
    return request(`/admin/profiles/${userId}/approve`, { method: 'PATCH' }, token);
  },
  rejectProfile(token: string, userId: string, reason: string) {
    return request(
      `/admin/profiles/${userId}/reject`,
      {
        method: 'PATCH',
        body: JSON.stringify({ reason }),
      },
      token,
    );
  },
};
