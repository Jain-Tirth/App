import { HttpStatus } from '@nestjs/common';
import { ApiException } from '../common/api-error';

/**
 * One body for every reason a profile cannot be shown (unknown, not approved,
 * hidden, the caller's own), so the answer never reveals which one it was.
 */
export function profileNotFound(): ApiException {
  return new ApiException(
    HttpStatus.NOT_FOUND,
    'PROFILE_NOT_FOUND',
    'This profile is not available.',
  );
}
