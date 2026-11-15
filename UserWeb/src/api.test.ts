import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api, onProfileNotApproved, putToStorage, request } from './api';

// The env module validates import.meta.env at import time; supply a fixed base.
vi.mock('./config/env', () => ({ env: { apiBaseUrl: 'http://api.test/api/v1' } }));

function mockFetch(impl: (url: string, init: RequestInit) => Promise<Response> | Response) {
  const fn = vi.fn(async (url: string, init: RequestInit) => impl(url, init));
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

async function failure(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    return error as ApiError;
  }
  throw new Error('expected a rejection');
}

describe('request', () => {
  it('parses a JSON success', async () => {
    mockFetch(() => new Response('{"ok":true}', { status: 200 }));
    expect(await request('/x')).toEqual({ ok: true });
  });

  it('handles a 204 without a body', async () => {
    mockFetch(() => new Response(null, { status: 204 }));
    expect(await request('/x', { method: 'DELETE' })).toBeUndefined();
  });

  it('turns the error envelope into an ApiError with all fields', async () => {
    mockFetch(
      () =>
        new Response(
          JSON.stringify({
            code: 'RESTART_LIMIT_REACHED',
            message: 'machine text',
            details: { a: 1 },
            requestId: 'req-1',
          }),
          { status: 429, headers: { 'Retry-After': '5400' } },
        ),
    );
    const error = await failure(request('/x'));
    expect(error.code).toBe('RESTART_LIMIT_REACHED');
    expect(error.status).toBe(429);
    expect(error.details).toEqual({ a: 1 });
    expect(error.retryAfter).toBe(5400);
    expect(error.requestId).toBe('req-1');
    expect(error.message).not.toContain('machine text');
  });

  it('turns an HTML error body into NON_JSON_RESPONSE', async () => {
    mockFetch(() => new Response('<html>Bad gateway</html>', { status: 502 }));
    const error = await failure(request('/x'));
    expect(error.code).toBe('NON_JSON_RESPONSE');
    expect(error.status).toBe(502);
    expect(error.message).not.toContain('html');
  });

  it('turns a non-JSON success body into NON_JSON_RESPONSE', async () => {
    mockFetch(() => new Response('hello', { status: 200 }));
    expect((await failure(request('/x'))).code).toBe('NON_JSON_RESPONSE');
  });

  it('turns a network failure into NETWORK_ERROR', async () => {
    mockFetch(() => Promise.reject(new TypeError('Failed to fetch')));
    const error = await failure(request('/x'));
    expect(error.code).toBe('NETWORK_ERROR');
    expect(error.message).not.toContain('Failed to fetch');
  });

  it('turns an aborted request into TIMEOUT', async () => {
    mockFetch(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => {
            const abort = new Error('aborted');
            abort.name = 'AbortError';
            reject(abort);
          });
        }),
    );
    const error = await failure(request('/x', { timeoutMs: 10 }));
    expect(error.code).toBe('TIMEOUT');
  });

  it('sends the bearer token and JSON content type', async () => {
    const fetchMock = mockFetch(() => new Response('{}', { status: 200 }));
    await request('/x', {}, 'tok');
    const init = fetchMock.mock.calls[0][1];
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer tok');
    expect(headers['Content-Type']).toBe('application/json');
  });
});

describe('profile submission calls', () => {
  it('submitProfile posts to /profiles/submit with the token', async () => {
    const fetchMock = mockFetch(() => new Response('{"status":"submitted"}', { status: 200 }));
    await api.submitProfile('tok');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.test/api/v1/profiles/submit');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
  });

  it('withdrawProfile posts to /profiles/withdraw', async () => {
    const fetchMock = mockFetch(() => new Response('{"status":"draft"}', { status: 200 }));
    await api.withdrawProfile('tok');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.test/api/v1/profiles/withdraw');
    expect(init.method).toBe('POST');
  });
});

describe('PROFILE_NOT_APPROVED listener', () => {
  afterEach(() => onProfileNotApproved(null));

  it('notifies the listener once and still rejects with the ApiError', async () => {
    const listener = vi.fn();
    onProfileNotApproved(listener);
    mockFetch(
      () =>
        new Response(JSON.stringify({ code: 'PROFILE_NOT_APPROVED', requestId: 'r1' }), {
          status: 403,
        }),
    );
    const error = await failure(request('/x'));
    expect(error.code).toBe('PROFILE_NOT_APPROVED');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('is not called for other error codes', async () => {
    const listener = vi.fn();
    onProfileNotApproved(listener);
    mockFetch(() => new Response(JSON.stringify({ code: 'NOT_FOUND' }), { status: 404 }));
    await failure(request('/x'));
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('putToStorage', () => {
  it('sends only the ticket headers: no bearer and no JSON content type', async () => {
    const fetchMock = mockFetch(() => new Response(null, { status: 200 }));
    const body = new Blob(['abc'], { type: 'image/png' });
    await putToStorage('https://storage.example/upload', { 'Content-Type': 'image/png' }, body);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://storage.example/upload');
    expect(init.method).toBe('PUT');
    expect(init.headers).toEqual({ 'Content-Type': 'image/png' });
    expect(init.body).toBe(body);
  });

  it('throws an ApiError when storage refuses', async () => {
    mockFetch(() => new Response('<Error>Denied</Error>', { status: 403 }));
    const error = await failure(putToStorage('https://s/x', {}, new Blob(['a'])));
    expect(error.status).toBe(403);
    expect(error.message).not.toContain('Denied');
  });
});
