import type {
  LoginResponse,
  ProfileResponse,
  RegisterPayload,
  RegisterResponse,
  VerifyOtpResponse,
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
    const text = await response.text();
    throw new Error(text || 'Request failed');
  }

  return response.json() as Promise<T>;
}

export const api = {
  register(payload: RegisterPayload) {
    return request<RegisterResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  resendOtp(countryCode: string, mobileNumber: string) {
    return request<RegisterResponse>('/auth/otp/resend', {
      method: 'POST',
      body: JSON.stringify({ countryCode, mobileNumber }),
    });
  },
  verifyOtp(countryCode: string, mobileNumber: string, otpCode: string) {
    return request<VerifyOtpResponse>('/auth/otp/verify', {
      method: 'POST',
      body: JSON.stringify({ countryCode, mobileNumber, otpCode }),
    });
  },
  login(email: string, password: string) {
    return request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },
  getMyProfile(token: string) {
    return request<ProfileResponse>('/profiles/me', {}, token);
  },
  saveStep1(
    token: string,
    payload: {
      gender: 'male' | 'female';
      dateOfBirth: string;
      heightCm?: number;
      physicalStatus?: 'normal' | 'physically_challenged';
      maritalStatus?:
        | 'never_married'
        | 'widower'
        | 'awaiting_divorce'
        | 'divorced';
    },
  ) {
    return request<ProfileResponse>('/profiles/step-1', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }, token);
  },
  saveStep2(token: string, payload: Record<string, unknown>) {
    return request<ProfileResponse>('/profiles/step-2', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }, token);
  },
  saveStep3(token: string, payload: Record<string, unknown>) {
    return request<ProfileResponse>('/profiles/step-3', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }, token);
  },
  saveStep4(token: string, payload: Record<string, unknown>) {
    return request<ProfileResponse>('/profiles/step-4', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }, token);
  },
  saveStep5(token: string, payload: Record<string, unknown>) {
    return request<ProfileResponse>('/profiles/step-5', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }, token);
  },
};
