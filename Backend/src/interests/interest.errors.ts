import { HttpStatus } from '@nestjs/common';
import { ApiException } from '../common/api-error';

/** Unknown, someone else's, or malformed: one body, so existence never leaks. */
export const interestNotFound = () =>
  new ApiException(
    HttpStatus.NOT_FOUND,
    'INTEREST_NOT_FOUND',
    'This interest was not found.',
  );

export const cannotInterestSelf = () =>
  new ApiException(
    HttpStatus.BAD_REQUEST,
    'CANNOT_INTEREST_SELF',
    'You cannot send an interest to yourself.',
  );

export const interestAlreadyExists = () =>
  new ApiException(
    HttpStatus.CONFLICT,
    'INTEREST_ALREADY_EXISTS',
    'You already have an active interest with this member.',
  );

export const interestCooldown = (retryAfter: Date) =>
  new ApiException(
    HttpStatus.CONFLICT,
    'INTEREST_COOLDOWN',
    'You cannot send an interest to this member yet.',
    { retryAfter: retryAfter.toISOString() },
  );

export const invalidInterestTransition = (status: string) =>
  new ApiException(
    HttpStatus.CONFLICT,
    'INVALID_STATUS_TRANSITION',
    'This interest cannot be changed that way.',
    { status },
  );

export const cooldownNotFound = () =>
  new ApiException(
    HttpStatus.NOT_FOUND,
    'COOLDOWN_NOT_FOUND',
    'No active cooldown was found for this pair.',
  );

export const invalidInterestCursor = () =>
  new ApiException(
    HttpStatus.BAD_REQUEST,
    'INVALID_CURSOR',
    'The cursor is not valid. Start again from the first page.',
    { field: 'cursor' },
  );
