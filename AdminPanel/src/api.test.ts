import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdminApiError, api } from './api';

// The env module validates import.meta.env at import time; supply a fixed base.
vi.mock('./config/env', () => ({ env: { apiBaseUrl: 'http://api.test/api/v1' } }));

function mockFetch(impl: (url: string, init: RequestInit) => Promise<Response> | Response) {
  const fn = vi.fn(async (url: string, init: RequestInit) => impl(url, init));
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

async function failure(promise: Promise<unknown>): Promise<AdminApiError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(AdminApiError);
    return error as AdminApiError;
  }
  throw new Error('expected a rejection');
}

describe('reopenProfile', () => {
  it('posts the reason and notes to the reopen endpoint with the token', async () => {
    const fetchMock = mockFetch(
      () => new Response('{"message":"ok","userId":"u1","status":"needsChanges"}', { status: 200 }),
    );
    const result = await api.reopenProfile('tok', 'u1', { reasonCode: 'other', notes: 'Second look' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.test/api/v1/admin/profiles/u1/reopen');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ reasonCode: 'other', notes: 'Second look' });
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
    expect(result.status).toBe('needsChanges');
  });

  it('turns the error envelope into an AdminApiError with code and status only', async () => {
    mockFetch(
      () =>
        new Response(JSON.stringify({ code: 'INVALID_STATUS_TRANSITION', message: 'machine text' }), {
          status: 409,
        }),
    );
    const error = await failure(api.reopenProfile('tok', 'u1', { reasonCode: 'other' }));
    expect(error.code).toBe('INVALID_STATUS_TRANSITION');
    expect(error.status).toBe(409);
    expect(error.message).not.toContain('machine text');
  });

  it('turns an HTML error body into NON_JSON_RESPONSE', async () => {
    mockFetch(() => new Response('<html>Bad gateway</html>', { status: 502 }));
    expect((await failure(api.reopenProfile('tok', 'u1', { reasonCode: 'other' }))).code).toBe(
      'NON_JSON_RESPONSE',
    );
  });

  it('turns a non-JSON success body into NON_JSON_RESPONSE', async () => {
    mockFetch(() => new Response('hello', { status: 200 }));
    expect((await failure(api.reopenProfile('tok', 'u1', { reasonCode: 'other' }))).code).toBe(
      'NON_JSON_RESPONSE',
    );
  });

  it('turns a network failure into NETWORK_ERROR', async () => {
    mockFetch(() => Promise.reject(new TypeError('Failed to fetch')));
    expect((await failure(api.reopenProfile('tok', 'u1', { reasonCode: 'other' }))).code).toBe(
      'NETWORK_ERROR',
    );
  });

  it('turns an aborted request into TIMEOUT', async () => {
    mockFetch(() => {
      const abort = new Error('aborted');
      abort.name = 'AbortError';
      return Promise.reject(abort);
    });
    expect((await failure(api.reopenProfile('tok', 'u1', { reasonCode: 'other' }))).code).toBe('TIMEOUT');
  });
});
