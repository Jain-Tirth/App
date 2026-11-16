import { HttpStatus } from '@nestjs/common';
import { ApiException } from '../common/api-error';

export const stepUpFailed = () =>
  new ApiException(
    HttpStatus.FORBIDDEN,
    'STEP_UP_FAILED',
    'The password you entered is not correct.',
  );

export const stepUpRateLimited = (retryAfterSeconds: number) =>
  new ApiException(
    HttpStatus.TOO_MANY_REQUESTS,
    'RATE_LIMITED',
    'Too many incorrect password attempts. Try again later.',
    { retryAfterSeconds },
    { 'Retry-After': String(retryAfterSeconds) },
  );

export const requestAlreadyPending = () =>
  new ApiException(
    HttpStatus.CONFLICT,
    'REQUEST_ALREADY_PENDING',
    'A request of this kind is already pending.',
  );

export const exportNotFound = () =>
  new ApiException(
    HttpStatus.NOT_FOUND,
    'EXPORT_NOT_FOUND',
    'This export was not found.',
  );

export const exportExpired = () =>
  new ApiException(
    HttpStatus.GONE,
    'EXPORT_EXPIRED',
    'This download link has expired. Request a new export.',
  );

export const deleteRequestNotFound = () =>
  new ApiException(
    HttpStatus.NOT_FOUND,
    'DELETE_REQUEST_NOT_FOUND',
    'There is no pending deletion request.',
  );

export const accountPurged = () =>
  new ApiException(
    HttpStatus.GONE,
    'ACCOUNT_PURGED',
    'The cooling-off period has ended and this account is being removed.',
  );

export const accountNotFound = () =>
  new ApiException(
    HttpStatus.NOT_FOUND,
    'ACCOUNT_NOT_FOUND',
    'This account was not found.',
  );

export const accountDeletionPending = (scheduledPurgeAt: Date) =>
  new ApiException(
    HttpStatus.FORBIDDEN,
    'ACCOUNT_DELETION_PENDING',
    'This account is scheduled for deletion. You can only cancel the request.',
    { scheduledPurgeAt: scheduledPurgeAt.toISOString() },
  );
