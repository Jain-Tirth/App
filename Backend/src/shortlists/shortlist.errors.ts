import { HttpStatus } from '@nestjs/common';
import { ApiException } from '../common/api-error';

/** Unknown, someone else's, or malformed: one body, so existence never leaks. */
export const shortlistNotFound = () =>
  new ApiException(
    HttpStatus.NOT_FOUND,
    'SHORTLIST_NOT_FOUND',
    'This shortlist was not found.',
  );

export const defaultShortlistProtected = () =>
  new ApiException(
    HttpStatus.CONFLICT,
    'DEFAULT_SHORTLIST_PROTECTED',
    'The default shortlist cannot be renamed or deleted.',
  );

export const shortlistNameTaken = () =>
  new ApiException(
    HttpStatus.CONFLICT,
    'SHORTLIST_NAME_TAKEN',
    'You already have a shortlist with this name.',
    { field: 'name' },
  );

export const cannotShortlistSelf = () =>
  new ApiException(
    HttpStatus.BAD_REQUEST,
    'CANNOT_SHORTLIST_SELF',
    'You cannot shortlist yourself.',
  );

/** Only reachable when SHORTLIST_MAX_LISTS or SHORTLIST_MAX_PROFILES is set. */
export const shortlistLimitExceeded = (limit: 'lists' | 'profiles', max: number) =>
  new ApiException(
    HttpStatus.CONFLICT,
    'SHORTLIST_LIMIT_EXCEEDED',
    'The shortlist limit has been reached.',
    { limit, max },
  );
