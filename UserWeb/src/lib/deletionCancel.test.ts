import { describe, expect, it } from 'vitest';
import { ApiError } from '../apiError';
import { decideCancelFailure } from './deletionCancel';

describe('decideCancelFailure', () => {
  it('treats 404 DELETE_REQUEST_NOT_FOUND as nothing pending and rechecks', () => {
    expect(decideCancelFailure(new ApiError({ code: 'DELETE_REQUEST_NOT_FOUND', status: 404 }))).toBe(
      'recheck',
    );
  });

  it('logs out on UNAUTHORIZED', () => {
    expect(decideCancelFailure(new ApiError({ code: 'UNAUTHORIZED', status: 401 }))).toBe('logout');
  });

  it('shows an error for anything else', () => {
    expect(decideCancelFailure(new ApiError({ code: 'ACCOUNT_PURGED', status: 410 }))).toBe('show-error');
    expect(decideCancelFailure(new Error('boom'))).toBe('show-error');
  });
});
